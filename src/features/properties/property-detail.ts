import { sanitizeLocalizedContent } from '@/features/localization/localized-content';
import type { PropertyDetail } from '@/types/property';

/**
 * GET /api/properties/:id → the app's PropertyDetail.
 *
 * ── Why a normalization step exists ─────────────────────────────────────
 * `description` is admin-written content that the backend localizes at save
 * time (backend/models/Property.js: `localizedField()`, a Mixed field), so it
 * arrives in one of two shapes:
 *
 *   'Sea views from every room'                             a listing saved
 *                                                           before localization
 *   { sourceLang: 'en', en: '…', tr: '…', ar: '…', … }      every listing saved
 *                                                           since
 *
 * Both are valid and will coexist until the optional backfill
 * (backend/scripts/backfillPropertyDescriptions.js) has run — and a listing
 * whose translation failed stays a string even after it. So the app accepts
 * both, once, here: the value is cleaned to exactly that contract (a string, or
 * an object holding only the six language strings and `sourceLang`), and
 * anything else — a number, an array, an object with no text — becomes null.
 *
 * It is NOT resolved to one language here. The screen resolves it per render
 * with resolveLocalizedContent, so switching the app's language re-renders the
 * description in the new language without refetching the property.
 *
 * Pure: no network, no React.
 */
export function normalizePropertyDetail(raw: PropertyDetail): PropertyDetail {
  return {
    ...raw,
    description: sanitizeLocalizedContent((raw as { description?: unknown }).description),
  };
}
