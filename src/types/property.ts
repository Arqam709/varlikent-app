/**
 * Property shapes, verified against the real backend model
 * (backend/models/Property.js) and a live GET /api/properties response.
 *
 * Type declarations only — erased at build time, no runtime cost.
 */

/** Backend enum: `['Sale', 'Rent']`. */
export type ListingType = 'Sale' | 'Rent';

/** Backend enum, all twelve values. */
export type PropertyType =
  | 'Apartment'
  | 'Villa'
  | 'Penthouse'
  | 'Duplex'
  | 'Studio'
  | 'Office'
  | 'Commercial'
  | 'Land'
  | 'Shop'
  | 'Warehouse'
  | 'Hotel'
  | 'Farm';

/** Backend enum: `['Available', 'Sold', 'Rented', 'Pending']`. */
export type PropertyStatus = 'Available' | 'Sold' | 'Rented' | 'Pending';

/**
 * The subset of a property the LIST needs.
 *
 * The API returns far more per property — address, description, agent contact
 * details, amenity booleans, and a `descriptionEmbedding` vector. Declaring
 * only what the card renders keeps the contract honest about what this screen
 * depends on. Extra fields still arrive at runtime and are simply ignored.
 */
export interface PropertySummary {
  _id: string;
  title: string;
  listingType: ListingType;
  price: number;
  /**
   * Optional and inconsistent in practice. The model calls it a label, but the
   * live data holds fully pre-formatted strings ("₺2,100,000", "₺25,000/month"),
   * a bare symbol ("₺"), and one raw "₺5190000". `formatPrice` handles all
   * three the same way the website does.
   */
  priceLabel?: string;
  district: string;
  propertyType: PropertyType;
  beds: number;
  baths: number;
  sqm: number;
  /** Cloudinary URL. Frequently an EMPTY STRING rather than absent. */
  mainImage?: string;
  /** Cloudinary URLs. Often an empty array. */
  images?: string[];
  featured?: boolean;
  status?: PropertyStatus;
}

/**
 * GET /api/properties
 *
 * Confirmed live: `{ success: true, count: 34, properties: [...] }`, sorted
 * newest-first. There is no pagination — the route reads no `limit`/`page`
 * query param and applies no `.limit()`, so every match is returned at once.
 */
export interface PropertiesResponse {
  success: true;
  count: number;
  properties: PropertySummary[];
}

/** One entry from GET /api/properties/areas. */
export interface PropertyArea {
  district: string;
  count: number;
}

/**
 * GET /api/properties/areas
 *
 * Confirmed live: `{ success: true, areas: [{ district, count }] }`, grouped
 * by the EXACT stored district string and sorted alphabetically.
 *
 * Because it groups on the raw value, case variants appear as separate
 * entries ("Beylikdüzü" and "beylikdüzü"). That mirrors the filter, which is
 * also an exact match — so each entry really does select its own properties.
 */
export interface PropertyAreasResponse {
  success: true;
  areas: PropertyArea[];
}

/**
 * The real, logged-in agent assigned to a listing.
 *
 * Returned ONLY by GET /api/properties/:id, and only ever as these three
 * fields — the backend runs the populated user through a whitelist
 * (`publicAgent` in services/agentAssignment.js), so email, role, isActive and
 * permissions never cross the wire. The admin-only agent selector does return
 * an email, but that is a separate endpoint with a separate serializer; it is
 * not what arrives here.
 *
 * Identity only. The listing's contact details live in the `agentPhone` /
 * `agentEmail` / `whatsappNumber` fields below — `agentEmail` is derived by
 * the server from this account, the other two are entered per property.
 */
export interface PropertyAgent {
  _id: string;
  name: string;
  /** Cloudinary URL. Often an EMPTY STRING rather than absent. */
  avatar?: string;
}

/**
 * The FULL property, as returned by GET /api/properties/:id.
 *
 * Extends PropertySummary rather than redeclaring it, so the list and the
 * detail screen can never drift apart on the fields they share.
 *
 * Everything added here is optional, and that is not defensive typing — it is
 * measured. Across the live dataset: `rooms`, `floor`, `totalFloors`,
 * `heating` and `buildingAge` are populated on 0 of 34 properties, `parking`
 * on 20, and `agentEmail` on 32. Marking them required would be a lie the
 * compiler would happily let us build a broken screen on top of.
 *
 * `descriptionEmbedding` is deliberately NOT declared. The API returns it —
 * a large ML vector — but the UI never reads it, so it stays out of the
 * contract.
 */
export interface PropertyDetail extends PropertySummary {
  address?: string;
  description?: string;
  rooms?: string;
  floor?: number;
  totalFloors?: number;
  buildingAge?: string;
  heating?: string;
  parking?: string;
  furnished?: boolean;
  balcony?: boolean;
  elevator?: boolean;
  pool?: boolean;
  garden?: boolean;
  /**
   * LEGACY free-text name. The backend no longer writes it — new and edited
   * listings get their agent identity from `agent` below. Still declared
   * because listings created before the agent system carry it.
   *
   * A FALLBACK ONLY. `agent.name` is authoritative; reading this first shows
   * the wrong person on a reassigned listing, because it can name someone
   * other than the account `agentEmail` was derived from.
   */
  agentName?: string;
  agentPhone?: string;
  /** Server-derived from the assigned agent's account when `agent` is set. */
  agentEmail?: string;
  whatsappNumber?: string;
  /**
   * `null` when no agent is assigned — and ALSO when the assigned account has
   * since been deactivated or demoted, because the server re-checks
   * eligibility on read. So a non-null value always means "a real, active
   * agent", and one truthiness check covers every case.
   *
   * Declared now so the type matches what the API already returns. Nothing
   * renders it yet: the Message Agent button belongs to a later phase.
   */
  agent?: PropertyAgent | null;
  createdAt?: string;
}

/**
 * GET /api/properties/:id
 *
 * Confirmed live: `{ success: true, property: {...} }`.
 * A missing id returns 404 `{ success: false, message: 'Property not found' }`.
 * A MALFORMED id (not a valid ObjectId) throws a Mongoose CastError and comes
 * back as a 500 from the global error handler, not a 404 — so the screen must
 * treat both as "could not load this property".
 */
export interface PropertyDetailResponse {
  success: true;
  property: PropertyDetail;
}
