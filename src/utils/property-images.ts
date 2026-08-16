import type { PropertySummary } from '@/types/property';

/**
 * Resolves the ordered, de-duplicated list of images that genuinely belong to
 * a property.
 *
 * Shared by the list card and the detail gallery so the two can never disagree
 * about whether a property has a photo — previously each resolved it
 * separately, which was consistent by coincidence rather than by construction.
 *
 * Rules, all verified against live API data:
 *
 *  - `mainImage` leads when present, then `images[]`.
 *  - `mainImage` equals `images[0]` on every property that has photos, so the
 *    Set collapses the duplicate. If they ever differ, mainImage still leads.
 *  - Absent images are stored as EMPTY STRINGS (`mainImage: ""`) as often as
 *    they are `undefined`, so a truthiness check is required — `??` would
 *    happily accept `""` and try to load it.
 *  - Returns `[]` when there is genuinely no image. Callers render the
 *    Varlikent placeholder; there is deliberately no stock-photo fallback.
 *
 * NOTE: there is no legacy `image` field. The website references
 * `property.image` in PropertyCard.jsx, but it exists neither in the Mongoose
 * model nor on any live document, so it is dead code and is not replicated
 * here.
 */
export function getPropertyImages(
  property: Pick<PropertySummary, 'mainImage' | 'images'>
): string[] {
  const candidates = [property.mainImage, ...(property.images ?? [])];

  const valid = candidates.filter(
    (url): url is string => typeof url === 'string' && url.trim() !== ''
  );

  return [...new Set(valid)];
}
