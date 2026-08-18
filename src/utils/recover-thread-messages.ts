import type { ConversationMessagesResponse, PropertyMessage } from '@/types/property-messaging';

const byId = (a: PropertyMessage, b: PropertyMessage) =>
  String(a._id) < String(b._id) ? -1 : String(a._id) > String(b._id) ? 1 : 0;

export function mergeMessagesById(
  current: PropertyMessage[],
  incoming: PropertyMessage[]
): PropertyMessage[] {
  if (!incoming?.length) return current;
  if (!current?.length) return [...incoming].sort(byId);

  const seen = new Set(current.map((message) => String(message._id)));
  const additions = incoming.filter((message) => message && !seen.has(String(message._id)));

  if (additions.length === 0) return current;

  return [...current, ...additions].sort(byId);
}

const newestIdOf = (messages: PropertyMessage[]): string | null =>
  messages.reduce<string | null>(
    (max, message) => (max === null || String(message._id) > max ? String(message._id) : max),
    null
  );

export type RecoveryResult = {
  messages: PropertyMessage[];
  /** True when the recovered range connects to what the client already had. */
  contiguous: boolean;
  nextCursor: string | null;
  hasMore: boolean;
};

export type FetchPage = (options: { before?: string }) => Promise<ConversationMessagesResponse>;


export async function collectRecoveryPages({
  current = [],
  fetchPage,
  maxPages = 5,
}: {
  current?: PropertyMessage[];
  fetchPage: FetchPage;
  maxPages?: number;
}): Promise<RecoveryResult> {
  const knownIds = new Set(current.map((message) => String(message._id)));

  let collected: PropertyMessage[] = [];
  let before: string | undefined;
  let lastPage: ConversationMessagesResponse | null = null;
  let contiguous = current.length === 0; // nothing to bridge to

  for (let page = 0; page < maxPages; page += 1) {
    // Sequential on purpose: each request needs the cursor returned by the
    // previous one, so these cannot be parallelised.
    const result = await fetchPage({ before });
    lastPage = result;

    const messages = Array.isArray(result?.messages) ? result.messages : [];
    collected = [...messages, ...collected];

    // Reached the start of the thread: everything there is, is now collected.
    if (messages.length === 0 || !result?.hasMore || !result?.nextCursor) {
      contiguous = true;
      break;
    }

    // Any shared message means the recovered range now touches local state.
    if (messages.some((message) => knownIds.has(String(message._id)))) {
      contiguous = true;
      break;
    }

    if (current.length === 0) {
      contiguous = true;
      break;
    }

    before = result.nextCursor;
  }

  return {
    messages: collected,
    contiguous,
    nextCursor: lastPage?.nextCursor ?? null,
    hasMore: Boolean(lastPage?.hasMore),
  };
}

export function applyRecovery(
  current: PropertyMessage[],
  recovery: RecoveryResult
): { messages: PropertyMessage[]; adoptCursor: boolean } {
  const collected = recovery?.messages ?? [];
  if (collected.length === 0) return { messages: current, adoptCursor: false };

  if (recovery.contiguous) {
    return {
      messages: mergeMessagesById(current, collected),
      adoptCursor: current.length === 0,
    };
  }

  const newestCollected = newestIdOf(collected);
  const newerThanBlock = current.filter((message) => String(message._id) > String(newestCollected));

  return {
    messages: mergeMessagesById([...collected].sort(byId), newerThanBlock),
    adoptCursor: true,
  };
}
