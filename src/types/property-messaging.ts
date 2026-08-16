
export interface MessagingParticipant {
  _id: string;
  name: string;
  /** Cloudinary URL. Often an EMPTY STRING rather than absent. */
  avatar?: string;
}

export interface MessagingPropertySummary {
  _id: string;
  title: string;
  district: string;
  listingType: 'Sale' | 'Rent';
  propertyType: string;
  price: number;
  priceLabel?: string;
  /** May be an empty string when the listing has no photography. */
  mainImage?: string;
  status?: string;
}

/** Which side of the conversation the authenticated caller is on. */
export type ConversationRole = 'customer' | 'agent';

/** 'closed' means history is readable but no new messages are accepted. */
export type ConversationStatus = 'open' | 'closed';

/**
 * The denormalized preview the backend keeps on the conversation itself, so an
 * inbox never has to fetch a message page just to render a row.
 *
 * NULL until someone actually speaks. The server emits it only when
 * `lastMessage.at` is set, which is the same signal that decides whether a
 * conversation is inbox-visible at all — so in a list response this is
 * effectively always present.
 *
 * `sender` is a bare user id. Compare it against the signed-in user's `_id` to
 * decide whether a preview needs a "You:" prefix.
 */
export interface ConversationLastMessage {
  text: string;
  sender: string | null;
  at: string;
}

/**
 * One row of GET /property-conversations.
 *
 * `counterparty` is already "the other person" resolved by the server — the
 * agent when the caller is the customer — so no client ever has to work out
 * which of two ids is its own. `unreadCount` is likewise the CALLER's own
 * count; the other side's is deliberately withheld (that would be a read
 * receipt, which V1 does not offer).
 */
export interface PropertyConversationSummary {
  _id: string;
  status: ConversationStatus;
  role: ConversationRole;
  property: MessagingPropertySummary | null;
  counterparty: MessagingParticipant | null;
  lastMessage: ConversationLastMessage | null;
  lastActivityAt: string;
  unreadCount: number;
  createdAt: string;
}

/**
 * GET /property-conversations/:id — the list row plus BOTH participants by
 * name, so a thread view can label messages without a second request.
 *
 * Extends the summary rather than restating it: the backend detail response is
 * literally `{ ...conversationResponse(...), customer, agent, property }`, so
 * the types mirror how the payload is actually built.
 */
export interface PropertyConversationDetail extends PropertyConversationSummary {
  customer: MessagingParticipant | null;
  agent: MessagingParticipant | null;
}

export interface PropertyMessage {
  _id: string;
  sender: string;
  text: string;
  createdAt: string;
}

/* ── Response envelopes ───────────────────────────────────────────────── */


export interface StartConversationResponse {
  success: true;
  conversationId: string;
  created: boolean;
}

export interface ConversationListResponse {
  success: true;
  count: number;
  conversations: PropertyConversationSummary[];
}

export interface ConversationDetailResponse {
  success: true;
  conversation: PropertyConversationDetail;
}

export interface ConversationMessagesResponse {
  success: true;
  messages: PropertyMessage[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface SendMessageResponse {
  success: true;
  message: PropertyMessage;
}

export interface MarkReadResponse {
  success: true;
  unreadCount: number;
  readAt: string;
}

/** Matches the backend's own cap. The server remains the final authority. */
export const MAX_MESSAGE_LENGTH = 2000;

/* ── Realtime ─────────────────────────────────────────────────────────── */

/**
 * The Socket.IO event the backend emits once a message is safely stored.
 *
 * Must match NEW_MESSAGE_EVENT in
 * backend/services/propertyMessagingRealtime.js exactly. A typo would fail
 * silently as "no live updates" rather than as an error, so the string lives in
 * one place on this side of the wire.
 */
export const PROPERTY_MESSAGE_NEW_EVENT = 'property-message:new';

/**
 * Payload of `property-message:new`.
 *
 * `message` REUSES PropertyMessage rather than restating its fields, because
 * the server builds it with the very same serializer that produces the REST
 * send response — a thread appends it with identical code either way.
 *
 * The event reaches BOTH participants, including the sender (which is what
 * keeps a second signed-in device in step). It deliberately carries no unread
 * count for either side: one shared payload exposing the other person's count
 * would be a read receipt, which this app does not offer. Each client derives
 * its own state from `message.sender`.
 *
 * `lastMessage` and `lastActivityAt` mirror what the server wrote to the
 * conversation. RT-1 does not consume them — the Chats inbox is RT-2 — but they
 * are typed here because they are part of the wire contract today.
 */
export interface PropertyMessageNewEvent {
  conversationId: string;
  message: PropertyMessage;
  lastMessage: ConversationLastMessage;
  lastActivityAt: string;
}
