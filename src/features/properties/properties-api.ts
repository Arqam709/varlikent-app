import { ApiError, apiRequest } from '@/services/api-client';
import type {
  ListingType,
  PropertiesResponse,
  PropertyArea,
  PropertyAreasResponse,
  PropertyDetail,
  PropertyDetailResponse,
  PropertySummary,
  PropertyType,
} from '@/types/property';

/**
 * Server-side filters for the property list.
 *
 * Only `listingType` for now. The backend already accepts district,
 * propertyType, price and sqm ranges, beds, baths and amenity flags — those
 * get added here as further optional keys when their UI exists, which is why
 * this is an object rather than a positional argument. Deliberately not a
 * generic query builder.
 */
export type PropertyListFilters = {
  listingType?: ListingType;
  /** EXACT, case-sensitive match — send a value straight from /areas. */
  district?: string;
  propertyType?: PropertyType;
  /** `price >= minPrice`. All stored prices are TRY (verified). */
  minPrice?: number;
  /** `price <= maxPrice`. */
  maxPrice?: number;
  /** EXACT bedroom count, not a minimum — the backend does `filter.beds = Number(beds)`. */
  beds?: number;
  /**
   * The backend does `if (featured !== undefined) filter.featured = featured === 'true'`,
   * so ONLY the literal string "true" selects featured listings — any other
   * value (including "false" or a typo) filters to the non-featured set.
   * Passing a real boolean here keeps that trap on this side of the wire.
   */
  featured?: boolean;
};

/**
 * Builds the query string by hand rather than via URLSearchParams, whose
 * behaviour varies across React Native's polyfill versions.
 *
 * Undefined, empty and non-finite values are dropped, so `/properties` stays
 * clean when nothing is filtered and NaN can never reach the backend (where
 * `Number(NaN)` would silently match nothing). Every value is percent-encoded,
 * which matters for Turkish district names — "Beylikdüzü" must go out as
 * UTF-8 or the exact match fails.
 */
function buildQuery(filters: PropertyListFilters): string {
  const parts: string[] = [];

  const add = (key: string, value: string | number | boolean | undefined) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'number' && !Number.isFinite(value)) return;

    // Booleans serialise to "true"/"false", which is exactly what the backend
    // string-compares against.
    const text = String(value).trim();
    if (text === '') return;

    parts.push(`${key}=${encodeURIComponent(text)}`);
  };

  add('listingType', filters.listingType);
  add('district', filters.district);
  add('propertyType', filters.propertyType);
  add('beds', filters.beds);
  add('minPrice', filters.minPrice);
  add('maxPrice', filters.maxPrice);
  add('featured', filters.featured);

  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

/**
 * The secondary ("advanced") filters — everything except listingType, which
 * the segmented control owns separately.
 *
 * Derived from PropertyListFilters rather than redeclared, so the panel and
 * the request can never drift apart.
 */
export type PropertySecondaryFilters = Omit<PropertyListFilters, 'listingType'>;

/** The list plus its total, so the screen never issues a second request. */
export type PropertyListResult = {
  count: number;
  properties: PropertySummary[];
};

/**
 * GET /api/properties[?listingType=Sale|Rent] → newest first.
 *
 * Now returns the `count` from the SAME response rather than discarding it.
 * The backend sets `count = properties.length`, so the fallback below is exact
 * rather than an approximation.
 */
export async function getProperties(
  filters: PropertyListFilters = {}
): Promise<PropertyListResult> {
  const response = await apiRequest<PropertiesResponse>(`/properties${buildQuery(filters)}`);

  // Defensive: a malformed body should yield an empty list, not a crash.
  const properties = Array.isArray(response?.properties) ? response.properties : [];

  return {
    count: typeof response?.count === 'number' ? response.count : properties.length,
    properties,
  };
}

/**
 * GET /api/properties/areas → the districts that actually have listings,
 * with a count each.
 *
 * Used to populate the district filter from real data rather than a
 * hardcoded list, so it stays correct as inventory changes.
 */
export async function getPropertyAreas(): Promise<PropertyArea[]> {
  const response = await apiRequest<PropertyAreasResponse>('/properties/areas');
  return Array.isArray(response?.areas) ? response.areas : [];
}

/**
 * GET /api/properties/:id → the full property.
 *
 * Reuses the same `apiRequest`, so base URL, timeout, JSON parsing and error
 * normalisation are inherited — nothing about networking is duplicated here.
 *
 * A 404 (unknown id) and a 500 (malformed ObjectId → Mongoose CastError) both
 * surface as ApiError, already carrying a readable message.
 */
export async function getPropertyById(id: string): Promise<PropertyDetail> {
  const response = await apiRequest<PropertyDetailResponse>(`/properties/${id}`);

  // A 200 with no property would otherwise crash the screen on first access.
  if (!response?.property) {
    throw new ApiError('unknown', 'This property could not be found.');
  }

  return response.property;
}
