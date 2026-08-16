/**
 * Compact timestamps for the Chats inbox.
 *
 * ── Why not toLocaleTimeString / toLocaleDateString ──────────────────────
 * The same reason messages/[id].tsx spells its clock out by hand: those APIs
 * vary across Android locales and Hermes builds, so the same conversation can
 * render "8:42 PM" on one phone and "20:42" on another. An inbox column that
 * changes width by device is worse than one that is merely opinionated.
 *
 * ── Why this is separate from the thread's formatMessageTime ─────────────
 * That helper is file-local to the thread screen and answers a different
 * question — a bubble always wants a clock, and shows a date only to
 * disambiguate. A row here must fit one short token in a fixed corner, so it
 * drops the clock entirely once the message is not from today. Sharing one
 * function would mean one of the two surfaces getting the wrong shape.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Midnight on the day `date` falls in, for whole-calendar-day comparisons. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "20:42" today · "Yesterday" · "12 Aug" this year · "12 Aug 2025" older.
 *
 * Returns '' for a missing or unparseable value so a row renders without a
 * timestamp rather than showing "Invalid Date".
 */
export function formatChatTime(iso: string | null | undefined): string {
  if (!iso) return '';

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  // Calendar days apart, not elapsed hours: a message sent at 23:50 is
  // "Yesterday" at 00:10, not "today, 20 minutes ago".
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

  if (days === 0) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  if (days === 1) return 'Yesterday';

  const label = `${date.getDate()} ${MONTHS[date.getMonth()]}`;

  // The year is only worth its width once it is actually ambiguous.
  return date.getFullYear() === now.getFullYear() ? label : `${label} ${date.getFullYear()}`;
}
