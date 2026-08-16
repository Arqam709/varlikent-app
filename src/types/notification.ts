import type { PropertySummary } from './property';

/**
 * Notification shapes for GET /api/notifications.
 *
 * V1 has exactly one kind of notification: "a new property was listed". The
 * item therefore IS a property, extended with the timestamp that made it new.
 *
 * Named generically on purpose — the saved-alert filters planned for a later
 * phase will add matched-alert metadata alongside these fields rather than
 * needing a different shape.
 */
export interface PropertyNotification extends PropertySummary {
  /** ISO date. The backend selects it explicitly for the feed. */
  createdAt: string;
}

/**
 * GET /api/notifications
 *
 * `snapshotAt` is the server time captured BEFORE the query ran. Sending it
 * back to PATCH /seen is what prevents a property created between the fetch
 * and the acknowledgement from being silently marked as read.
 */
export interface NotificationsResponse {
  success: true;
  count: number;
  snapshotAt: string;
  notifications: PropertyNotification[];

  /**
   * Which of the properties above match at least one ACTIVE saved alert.
   *
   * A set of property ids, not a row per (property, alert) pair — a property
   * matching three alerts appears once. The server does the matching; the app
   * filters the feed it already holds, so switching to Matches issues no
   * second request and cannot race the /seen call.
   */
  matchedPropertyIds: string[];

  /**
   * How many active alerts this user has. Distinguishes "no alerts saved yet"
   * from "alerts saved, but nothing new matched" — different empty states
   * needing different advice.
   */
  alertCount: number;
}

/** GET /api/notifications/unread-count */
export interface UnreadCountResponse {
  success: true;
  count: number;
}
