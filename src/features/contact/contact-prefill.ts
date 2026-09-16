/**
 * A message another screen asked the Contact form to start from.
 *
 * Design My Space hands its board over as `/contact?message=…`. This is the
 * only thing that reads that parameter, and it exists so the Contact screen
 * treats it as UNTRUSTED text rather than as content:
 *
 *   • a route parameter can arrive as `string[]` (repeated keys) or undefined
 *   • it can arrive from a deep link, i.e. from outside the app entirely
 *   • it is placed in an editable field, never submitted on the user's behalf
 *
 * So it is narrowed to a single string, trimmed, and capped. The cap is not a
 * backend limit — `ContactSubmission.message` has none — it is a guard against
 * a link that would otherwise fill the form with megabytes of text.
 *
 * Deliberately NOT part of the contact interest contract: this changes nothing
 * about which interests exist, which one is selected, or what is submitted.
 */

/** Long enough for any design board with room to spare; short enough to be sane. */
export const CONTACT_MESSAGE_PREFILL_LIMIT = 2000;

export function requestedContactMessage(param: unknown): string {
  if (typeof param !== 'string') return '';
  return param.trim().slice(0, CONTACT_MESSAGE_PREFILL_LIMIT);
}
