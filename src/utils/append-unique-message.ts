/**
 * Appends one persisted message to a thread, ignoring it if that `_id` is
 * already there.
 *
 * ── Why a thread needs this at all ──────────────────────────────────────
 * Since RT-1 a message can reach the same screen through TWO paths:
 *
 *   1. the POST response  — the server-persisted message, returned to whoever
 *                           sent it
 *   2. property-message:new — the socket event, which is emitted to BOTH
 *                           participants, the sender included
 *
 * Emitting to the sender as well is deliberate: it is what keeps a second
 * signed-in device (or a second browser tab) in step. The cost is that the
 * sender's own client receives its message twice, and the two can arrive in
 * EITHER order — the socket frequently wins, because it is pushed the moment
 * the write commits while the POST response still has a round trip to finish.
 *
 * Comparing on the server-assigned `_id` makes arrival order irrelevant:
 * whichever copy lands first is appended, the second is dropped, and the result
 * is identical either way. That is why no optimistic-message reconciliation and
 * no temporary client ids are needed anywhere in this feature.
 *
 * ── Why String() on both sides ──────────────────────────────────────────
 * `_id` is typed as a string and arrives as one over JSON from both paths, so
 * this is belt and braces rather than a known mismatch. It costs nothing, and
 * it means a future caller passing a raw ObjectId cannot silently reintroduce
 * duplicates — the exact bug this function exists to prevent.
 *
 * Generic over `{ _id: string }` rather than importing PropertyMessage: the
 * rule is about identity, not about messages, and staying dependency-free keeps
 * the module directly testable.
 *
 * Returns the ORIGINAL array reference when the message is already present, so
 * React skips the re-render entirely.
 */
export function appendUniqueMessage<T extends { _id: string }>(
  current: T[],
  incoming: T
): T[] {
  return current.some((item) => String(item._id) === String(incoming._id))
    ? current
    : [...current, incoming];
}
