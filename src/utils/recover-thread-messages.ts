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

const oldestIdOf = (messages: PropertyMessage[]): string | null =>
  messages.reduce<string | null>(
    (min, message) => (min === null || String(message._id) < min ? String(message._id) : min),
    null
  );

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

  /*
   * The server returns only what THIS user may see ("Delete for me" and
   * "Delete conversation" are applied server-side). So a message that is on
   * screen but absent from the recovered range was removed on another of this
   * user's devices while this one was offline — and must leave here too, or
   * the thread would never converge. Adding unknown ids alone cannot do that.
   */
  const reachedStart = !recovery?.hasMore;

  if (collected.length === 0) {
    // The recovery walked to the start of the thread and found nothing visible:
    // the whole conversation was cleared for this user.
    if (recovery?.contiguous && reachedStart && current.length > 0) {
      return { messages: [], adoptCursor: false };
    }
    return { messages: current, adoptCursor: false };
  }

  if (recovery.contiguous) {
    const returned = new Set(collected.map((message) => String(message._id)));
    const oldest = oldestIdOf(collected);
    const newest = newestIdOf(collected);

    // Authoritative inside the recovered window only. Anything newer arrived
    // after the fetch (socket) and is kept; anything older than the window is
    // outside what was checked — unless the walk reached the thread's start.
    const kept = current.filter((message) => {
      const id = String(message._id);
      if (returned.has(id)) return true;
      if (newest !== null && id > newest) return true;
      if (!reachedStart && oldest !== null && id < oldest) return true;
      return false;
    });

    return {
      messages: mergeMessagesById(kept.length === current.length ? current : kept, collected),
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
