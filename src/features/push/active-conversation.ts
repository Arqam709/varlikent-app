/**
 * Which conversation the user is currently looking at.
 *
 * ── Why this exists ──────────────────────────────────────────────────────
 * When an agent replies while the customer has that exact thread open, two
 * things happen at once: Socket.IO renders the message in the chat, and the
 * push arrives. Showing an OS banner as well would notify someone about a
 * message they are already reading.
 *
 * The backend cannot solve this. It knows a device is registered; it does not
 * know which screen is in front of the user, and building presence tracking
 * just to answer that would be a large, failure-prone system for a cosmetic
 * problem. So the backend always sends — which is what keeps the background and
 * terminated cases correct — and the DEVICE, which alone knows what is on
 * screen, decides whether to draw a banner.
 *
 * ── Why a module variable rather than context ────────────────────────────
 * `setNotificationHandler` is registered once at module scope, outside React,
 * and runs for notifications that arrive at any moment. It cannot read a hook.
 * A single module-scoped value is the smallest thing that both the screen and
 * the handler can reach, and it is per-process so it resets naturally on
 * relaunch.
 */

let activeConversationId: string | null = null;

/** Called by the conversation screen on focus, and cleared on blur. */
export function setActiveConversation(conversationId: string | null): void {
  activeConversationId = conversationId ? String(conversationId) : null;
}

/**
 * True when this conversation is the one on screen right now.
 *
 * Only ever consulted while the app is in the FOREGROUND — a backgrounded app
 * has no visible screen, and the notification handler is not what decides
 * whether a background notification is shown.
 */
export function isActiveConversation(conversationId: unknown): boolean {
  return (
    typeof conversationId === 'string' &&
    activeConversationId !== null &&
    activeConversationId === conversationId
  );
}
