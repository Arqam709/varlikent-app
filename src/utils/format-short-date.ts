/**
 * A short, localized calendar date — `28 Sep 2026` in English, `28 Eyl 2026`
 * in Turkish — for lists such as My Requests and My Designs.
 *
 * '' for anything that is not a real date, so a row simply omits it.
 */
export function formatShortDate(iso: string, language: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  try {
    return date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
