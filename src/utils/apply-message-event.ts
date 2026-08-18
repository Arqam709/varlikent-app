import type {
  PropertyConversationSummary,
  PropertyMessageNewEvent,
} from '@/types/property-messaging';

export type MessageEventResult = {
  conversations: PropertyConversationSummary[];
  /** True when the conversation is not in the list and a refetch is needed. */
  unknown: boolean;
};

export type MessageEventOptions = {
  /** The signed-in user, so their own messages never raise their own badge. */
  currentUserId?: string | null;
  activeConversationId?: string | null;
};

export function applyMessageEventToConversations(
  current: PropertyConversationSummary[],
  payload: PropertyMessageNewEvent,
  { currentUserId = null, activeConversationId = null }: MessageEventOptions = {}
): MessageEventResult {
  const conversationId = payload?.conversationId ? String(payload.conversationId) : '';
  if (!conversationId) return { conversations: current, unknown: false };

  const index = current.findIndex((item) => String(item._id) === conversationId);

  // Not in the list — the caller refetches rather than guessing at a row.
  if (index === -1) return { conversations: current, unknown: true };

  const existing = current[index];

  const senderId = payload.message?.sender ? String(payload.message.sender) : null;
  const sentByMe = Boolean(senderId && currentUserId && senderId === String(currentUserId));
  const isBeingRead =
    Boolean(activeConversationId) && String(activeConversationId) === conversationId;

  const updated: PropertyConversationSummary = {
    ...existing,

    // Raw server data, never a formatted string. The row derives its own
    // "You:" prefix from lastMessage.sender, so keeping the shape identical to
    // what REST returns means the rendering rules keep working untouched.
    lastMessage: payload.lastMessage ?? existing.lastMessage,
    lastActivityAt: payload.lastActivityAt ?? existing.lastActivityAt,

    unreadCount:
      sentByMe || isBeingRead ? existing.unreadCount : (existing.unreadCount || 0) + 1,
  };

  // Replace in place, then order by activity. Replacing rather than inserting
  // is what guarantees one row per conversation id — appending the updated copy
  // without removing the old one is how a list grows duplicate keys.
  const next = current.map((item, i) => (i === index ? updated : item));

  return {
    conversations: next
      .slice()
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()),
    unknown: false,
  };
}
