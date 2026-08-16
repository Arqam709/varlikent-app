import type { ListingType, PropertyType } from './property';

/**
 * A saved description of the kind of property a user is waiting for.
 *
 * Reuses ListingType and PropertyType from the property types rather than
 * redeclaring them, so the alert vocabulary can never drift from the
 * inventory's.
 *
 * Every criterion is optional and they combine with AND. `minBeds` is a
 * MINIMUM — unlike the properties filter's exact `beds` — because "3+
 * bedrooms" is what someone waiting for a listing actually means.
 */
export interface PropertyAlert {
  _id: string;
  listingType?: ListingType;
  /** Exact, case-sensitive; sourced from GET /properties/areas. */
  district?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
  /** Honoured by matching. No V1 UI toggle — users edit or delete. */
  active: boolean;
  createdAt: string;
}

/** The editable criteria, without server-owned fields. */
export type PropertyAlertInput = {
  listingType?: ListingType;
  district?: string;
  propertyType?: PropertyType;
  minPrice?: number;
  maxPrice?: number;
  minBeds?: number;
};

/** GET /api/property-alerts */
export interface PropertyAlertsResponse {
  success: true;
  count: number;
  alerts: PropertyAlert[];
}

/** POST /api/property-alerts and PATCH /api/property-alerts/:id */
export interface PropertyAlertResponse {
  success: true;
  alert: PropertyAlert;
}
