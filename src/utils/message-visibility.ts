import type {
  PropertyConversationSummary,
  PropertyMessage,
  PropertyMessageHiddenEvent,
} from '@/types/property-messaging';

/**
 * "DELETE FOR ME" — the pure state rules for the thread and the inbox.
 *
 * Both actions change only what THIS user sees. The server is the source of
 * truth (it stops returning hidden messages and removed rows to this user);
 * these helpers keep what is already on screen in step with it — optimistically
 * on the device that acted, and through realtime on the user's other devices.
 * Nothing here ever affects the other participant.
 *
 * Pure: type-only imports, no React, no network.
 */

/**
 * Whether "Delete for me" is offered: only on the user's OWN messages in V1.
 * The server enforces the same rule; this only decides whether to show it.
 */
export function canHideMessage(
  message: PropertyMessage | null | undefined,
  currentUserId: string | null | undefined
): boolean {
  return Boolean(message && currentUserId && String(message.sender) === String(currentUserId));
}

/** The thread without this message. Returns `current` when it is not loaded. */
export function removeMessageById(current: PropertyMessage[], messageId: string): PropertyMessage[] {
  const next = current.filter((message) => String(message._id) !== String(messageId));
  return next.length === current.length ? current : next;
}

/** The inbox without this conversation. Returns `current` when it is not listed. */
export function removeConversationById(
  current: PropertyConversationSummary[],
  conversationId: string
): PropertyConversationSummary[] {
  const next = current.filter((item) => String(item._id) !== String(conversationId));
  return next.length === current.length ? current : next;
}

/**
 * Puts a conversation back after a failed "Delete conversation", in activity
 * order. A row that has meanwhile reappeared (a refetch) is left as it is.
 */
export function restoreConversation(
  current: PropertyConversationSummary[],
  conversation: PropertyConversationSummary
): PropertyConversationSummary[] {
  if (current.some((item) => String(item._id) === String(conversation._id))) return current;
  return [...current, conversation].sort(
    (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
  );
}

/**
 * Folds a `property-message:hidden` event (this user's own action, possibly
 * on another device) into the inbox.
 *
 * `inInbox: false` → the user can see nothing in that conversation any more,
 * so the row goes. Otherwise the row takes the user's new preview. Unread
 * counts and ordering are untouched: hiding your own message changes neither.
 */
export function applyHiddenMessageToConversations(
  current: PropertyConversationSummary[],
  payload: Pick<PropertyMessageHiddenEvent, 'conversationId' | 'lastMessage' | 'inInbox'> | null | undefined
): PropertyConversationSummary[] {
  const conversationId = payload?.conversationId ? String(payload.conversationId) : '';
  if (!conversationId) return current;

  if (!payload?.inInbox) return removeConversationById(current, conversationId);

  let changed = false;
  const next = current.map((item) => {
    if (String(item._id) !== conversationId) return item;
    changed = true;
    return { ...item, lastMessage: payload.lastMessage ?? null };
  });
  return changed ? next : current;
}
