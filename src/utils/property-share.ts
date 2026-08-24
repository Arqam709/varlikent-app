import { WEB_BASE_URL } from '@/constants/config';
import type { PropertySummary } from '@/types/property';

/**
 * Building the public link and message for sharing a property.
 *
 * ── Why the shared link is an ordinary website URL ───────────────────────
 * `https://www.varlikent.com/properties/<id>` is the website's own canonical
 * address for a listing, and it is deliberately NOT a `varlikentapp://` link.
 * A customer forwards this to someone who may not have the app: with an HTTPS
 * URL that person simply lands on the website, whereas a custom scheme would be
 * a dead string. Android App Links then open the app for whoever does have it,
 * so one URL serves both without a redirect service.
 */

/**
 * The public URL for a property.
 *
 * @returns The canonical URL, or `null` when there is no usable id — so a
 *   caller cannot accidentally produce `…/properties/undefined`. The Share
 *   control is only rendered once a property has loaded, but a builder that
 *   can return a broken URL is a builder that eventually will.
 */
export function buildPropertyUrl(propertyId: string | undefined | null): string | null {
  const id = typeof propertyId === 'string' ? propertyId.trim() : '';
  if (!id) return null;

  // encodeURIComponent rather than raw interpolation: the id is a Mongo
  // ObjectId today, but a builder should not assume what it is handed.
  return `${WEB_BASE_URL}/properties/${encodeURIComponent(id)}`;
}

/**
 * One readable line describing the listing.
 *
 * The admin-authored `title` is preferred, because a person wrote it for this
 * exact property, in the language the listing was created in. The district is
 * only a fallback for a listing that has no title at all.
 *
 * Deliberately NOT "<title> in <district>". That "in" is an English word, and
 * this app ships in English, Turkish, and Arabic — a hard-coded conjunction
 * would read as broken grammar for two of the three audiences. Per-locale
 * sentence building is not worth it for one line above a link, and the title
 * already carries the useful information.
 *
 * Whitespace is collapsed so a title pasted with line breaks does not arrive as
 * a ragged block in a chat. The property object is never mutated.
 *
 * (The backend has a similar helper for push notification bodies. It is
 * deliberately not shared, and it deliberately behaves differently: a
 * notification is generated server-side in one language and has a tray length
 * bound to respect, whereas this text is quoted verbatim into a stranger's
 * chat. Importing across the two projects is not possible in any case.)
 */
export function describePropertyForShare(property: Pick<PropertySummary, 'title' | 'district'>): string {
  const title = String(property?.title ?? '').replace(/\s+/g, ' ').trim();
  if (title) return title;

  // A titleless listing still deserves one human word above the link.
  return String(property?.district ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * The full message handed to the share sheet.
 *
 * Everything goes in `message` rather than being split across `message` and
 * `url`, because Android ignores `url` entirely — a link passed only that way
 * would silently vanish from a WhatsApp share.
 *
 * Deliberately short, and deliberately WITHOUT a price. A forwarded message can
 * outlive the price it quotes, and a stale figure sitting in someone's chat is
 * worse than no figure: the property page stays the source of truth.
 *
 * @param callToAction Translated, e.g. "View on Varlikent:".
 */
export function buildPropertyShareMessage({
  property,
  url,
  callToAction,
}: {
  property: Pick<PropertySummary, 'title' | 'district'>;
  url: string;
  callToAction: string;
}): string {
  const description = describePropertyForShare(property);

  // The description is omitted rather than left as an empty line if a listing
  // somehow has neither title nor district.
  return description
    ? `${description}\n\n${callToAction}\n${url}`
    : `${callToAction}\n${url}`;
}
