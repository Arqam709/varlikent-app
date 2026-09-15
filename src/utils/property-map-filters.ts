import type { PropertySecondaryFilters } from '@/features/properties/properties-api';
import type { ListingType, PropertyType } from '@/types/property';

/**
 * THE QUERY, CARRIED FROM THE LIST TO THE MAP.
 *
 * ── Why route params and not a Context ──────────────────────────────────
 * The Map screen must show the SAME search, not a second independent one. The
 * three ways to arrange that are a shared Context, a store, or the URL — and
 * the URL is what this app already uses: the Properties list seeds its own
 * All/Buy/Rent segment from a `listingType` route param today, which is how
 * the Home screen deep-links into "Rent".
 *
 * Route params also solve "preserve the filters when going back" for free, and
 * for a reason worth stating plainly: the Properties tab is NOT unmounted when
 * a stack screen is pushed over it. Its `useState` filters are still sitting
 * there when the map is dismissed. A Context would add a second copy of state
 * that has to be kept in sync with that one — more machinery, and a new way
 * for the two screens to disagree about what the current search is.
 *
 * ── What crosses, and what deliberately does not ────────────────────────
 * ONLY the query. Never property objects: the map refetches, so it can never
 * render a stale snapshot captured when the list last loaded, and a URL cannot
 * grow unbounded with serialized listings. This is the same reasoning the list
 * already applies when it navigates to a property detail with just an id.
 *
 * ── Why everything is re-validated on the way in ────────────────────────
 * A route param is user-controllable text. It arrives from a deep link, a
 * restored navigation state, or a typo, and `Number('abc')` is NaN — which the
 * properties API would drop, but only after it had already been treated as a
 * real filter by the UI. So `fromMapParams` never trusts its input: anything
 * it cannot verify is dropped rather than guessed at, and the result is always
 * a valid query, possibly an empty one.
 *
 * Pure: type-only imports, no React, no network, no navigation.
 */

/** Backend enums, restated as runtime values so params can be checked against them. */
const LISTING_TYPES: ListingType[] = ['Sale', 'Rent'];

const PROPERTY_TYPES: PropertyType[] = [
  'Apartment',
  'Villa',
  'Penthouse',
  'Duplex',
  'Studio',
  'Office',
  'Commercial',
  'Land',
  'Shop',
  'Warehouse',
  'Hotel',
  'Farm',
];

/**
 * The Properties list's All/Buy/Rent selection.
 *
 * `'All'` is a UI-only value: it contributes no `listingType` to the request,
 * which is why it is modelled here rather than reused from the backend enum.
 */
export type PropertySegment = 'All' | ListingType;

/** The complete query the two screens share. */
export type PropertyQuery = {
  segment: PropertySegment;
  filters: PropertySecondaryFilters;
};

/**
 * Route params are strings. Expo Router types them as
 * `string | string[] | undefined` because a param CAN repeat in a URL, so
 * every reader has to handle the array case or crash on `.trim()`.
 */
type RawParam = string | string[] | undefined;

/** The first value of a possibly-repeated param, trimmed; `undefined` when empty. */
function readParam(value: RawParam): string | undefined {
  const first = Array.isArray(value) ? value[0] : value;
  if (typeof first !== 'string') return undefined;

  const trimmed = first.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * A finite, non-negative number, or `undefined`.
 *
 * Rejects NaN and Infinity — the two values `Number()` happily produces from
 * junk — and negatives, which no price or bedroom count can be. A rejected
 * value is DROPPED rather than clamped: silently turning `minPrice=-5` into 0
 * would show the customer results for a filter they did not ask for.
 */
function readNumber(value: RawParam): number | undefined {
  const text = readParam(value);
  if (text === undefined) return undefined;

  const parsed = Number(text);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;

  return parsed;
}

/** Reads a param only if it is one of the allowed literals. */
function readEnum<T extends string>(value: RawParam, allowed: T[]): T | undefined {
  const text = readParam(value);
  return text !== undefined && (allowed as string[]).includes(text) ? (text as T) : undefined;
}

export function toMapParams(query: PropertyQuery): Record<string, string> {
  const params: Record<string, string> = {};
  const { segment, filters } = query;

  if (segment === 'Sale' || segment === 'Rent') params.listingType = segment;

  if (filters.district) params.district = filters.district;
  if (filters.propertyType) params.propertyType = filters.propertyType;
  if (filters.minPrice !== undefined) params.minPrice = String(filters.minPrice);
  if (filters.maxPrice !== undefined) params.maxPrice = String(filters.maxPrice);
  if (filters.beds !== undefined) params.beds = String(filters.beds);
  if (filters.featured !== undefined) params.featured = String(filters.featured);

  return params;
}

export function fromMapParams(params: Record<string, RawParam>): PropertyQuery {
  const filters: PropertySecondaryFilters = {};

  const district = readParam(params.district);
  if (district !== undefined) filters.district = district;

  const propertyType = readEnum(params.propertyType, PROPERTY_TYPES);
  if (propertyType !== undefined) filters.propertyType = propertyType;

  const minPrice = readNumber(params.minPrice);
  if (minPrice !== undefined) filters.minPrice = minPrice;

  const maxPrice = readNumber(params.maxPrice);
  if (maxPrice !== undefined) filters.maxPrice = maxPrice;

  const beds = readNumber(params.beds);
  if (beds !== undefined) filters.beds = beds;
  const featured = readParam(params.featured);
  if (featured === 'true') filters.featured = true;
  else if (featured === 'false') filters.featured = false;

  return {
    segment: readEnum(params.listingType, LISTING_TYPES) ?? 'All',
    filters,
  };
}
export function toPropertyListFilters(query: PropertyQuery) {
  return {
    ...(query.segment === 'All' ? {} : { listingType: query.segment }),
    ...query.filters,
  };
}

export function countActiveFilters(filters: PropertySecondaryFilters): number {
  return (
    (filters.district ? 1 : 0) +
    (filters.propertyType ? 1 : 0) +
    (filters.minPrice !== undefined || filters.maxPrice !== undefined ? 1 : 0) +
    (filters.beds !== undefined ? 1 : 0)
  );
}
