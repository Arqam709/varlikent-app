import { apiRequest } from '@/services/api-client';
import type {
  NotificationsResponse,
  PropertyNotification,
  UnreadCountResponse,
} from '@/types/notification';

/**
 * NOTIFICATION ENDPOINTS
 *
 * Pure network layer, mirroring auth-api.ts and properties-api.ts. Every call
 * requires a token: notification state is per-user and the backend rejects
 * anonymous requests with 401.
 */

export type NotificationFeed = {
  count: number;
  /** Pass to `markNotificationsSeen` after the feed is on screen. */
  snapshotAt: string;
  notifications: PropertyNotification[];
  /** Ids within `notifications` that match an active saved alert. */
  matchedPropertyIds: string[];
  /** Active alert count — separates "no alerts" from "no new matches". */
  alertCount: number;
};

/** GET /api/notifications → new properties since this user's baseline. */
export async function getNotifications(token: string): Promise<NotificationFeed> {
  const response = await apiRequest<NotificationsResponse>('/notifications', { token });

  const notifications = Array.isArray(response?.notifications) ? response.notifications : [];

  return {
    count: typeof response?.count === 'number' ? response.count : notifications.length,
    // Falling back to "now" keeps /seen working even if the field is missing.
    snapshotAt: response?.snapshotAt ?? new Date().toISOString(),
    notifications,
    // Defaults keep the screen working against a backend that predates 4B.
    matchedPropertyIds: Array.isArray(response?.matchedPropertyIds)
      ? response.matchedPropertyIds
      : [],
    alertCount: typeof response?.alertCount === 'number' ? response.alertCount : 0,
  };
}

export async function getUnreadCount(token: string): Promise<number> {
  const response = await apiRequest<UnreadCountResponse>('/notifications/unread-count', {
    token,
  });

  return typeof response?.count === 'number' ? response.count : 0;
}

export async function markNotificationsSeen(token: string, seenAt: string): Promise<void> {
  await apiRequest('/notifications/seen', {
    method: 'PATCH',
    token,
    body: { seenAt },
  });
}
