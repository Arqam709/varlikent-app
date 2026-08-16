import { apiRequest } from '@/services/api-client';
import type {
    ConversationDetailResponse,
    ConversationListResponse,
    ConversationMessagesResponse,
    PropertyConversationDetail,
    PropertyConversationSummary,
    PropertyMessage,
    SendMessageResponse,
    StartConversationResponse,
} from '@/types/property-messaging';

/**
 * The signed-in user's conversations, newest activity first.
 *
 * The SAME endpoint the agent website inbox uses — the backend derives which
 * side of each conversation the caller is on from the JWT, so there is no
 * customer-specific route and nothing here names a participant.
 *
 * Conversations nobody has written in yet are excluded by the SERVER, not
 * here: tapping "Message Agent" creates a thread before any text exists, and
 * it stays out of both inboxes until a real message lands. The list is already
 * sorted by the backend, so it is not re-sorted on arrival.
 *
 * `limit` defaults to the backend's maximum rather than its default of 20 —
 * there is no pagination UI on the inbox, so a lower ceiling would silently
 * drop a customer's older conversations off the bottom.
 */
export async function getPropertyConversations(
  token: string,
  options: { limit?: number } = {}
): Promise<PropertyConversationSummary[]> {
  const limit = options.limit ?? 50;

  const response = await apiRequest<ConversationListResponse>(
    `/property-conversations?limit=${limit}`,
    { token }
  );

  // Defensive, matching getPropertyMessages: a malformed body yields an empty
  // inbox rather than a crash.
  return Array.isArray(response?.conversations) ? response.conversations : [];
}

export async function startPropertyConversation(
  token: string,
  propertyId: string
): Promise<StartConversationResponse> {
  return apiRequest<StartConversationResponse>('/property-conversations', {
    method: 'POST',
    token,
    body: { propertyId },
  });
}

export async function getPropertyConversation(
  token: string,
  conversationId: string
): Promise<PropertyConversationDetail> {
  const response = await apiRequest<ConversationDetailResponse>(
    `/property-conversations/${conversationId}`,
    { token }
  );
  return response.conversation;
}

export async function getPropertyMessages(
  token: string,
  conversationId: string,
  options: { before?: string; limit?: number } = {}
): Promise<ConversationMessagesResponse> {
  const params: string[] = [];
  if (options.limit) params.push(`limit=${options.limit}`);
  if (options.before) params.push(`before=${encodeURIComponent(options.before)}`);
  const queryString = params.length > 0 ? `?${params.join('&')}` : '';

  const response = await apiRequest<ConversationMessagesResponse>(
    `/property-conversations/${conversationId}/messages${queryString}`,
    { token }
  );

  // Defensive: a malformed body should yield an empty page, not a crash.
  return {
    success: true,
    messages: Array.isArray(response?.messages) ? response.messages : [],
    nextCursor: response?.nextCursor ?? null,
    hasMore: Boolean(response?.hasMore),
  };
}

export async function sendPropertyMessage(
  token: string,
  conversationId: string,
  text: string
): Promise<PropertyMessage> {
  const response = await apiRequest<SendMessageResponse>(
    `/property-conversations/${conversationId}/messages`,
    { method: 'POST', token, body: { text } }
  );
  return response.message;
}

export async function markPropertyConversationRead(
  token: string,
  conversationId: string
): Promise<void> {
  await apiRequest(`/property-conversations/${conversationId}/read`, {
    method: 'PATCH',
    token,
  });
}
