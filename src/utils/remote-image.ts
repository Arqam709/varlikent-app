/**
 * An image URL the app can actually display, or ''.
 *
 * Admin-managed content (showroom media, CMS fields) may hold:
 *   - absolute http(s) image URLs        → used
 *   - site-relative paths ('/images/…')  → '' (they point into the website's
 *                                          own bundle and do not exist here)
 *   - video URLs                         → '' (the app has no video player)
 *   - anything else                      → ''
 */
const VIDEO_URL = /\/video\/|\.(mp4|mov|webm|avi|m4v)(?:[?#]|$)/i;

export function usableRemoteImage(value: unknown): string {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) return '';
  if (VIDEO_URL.test(url)) return '';
  return url;
}
