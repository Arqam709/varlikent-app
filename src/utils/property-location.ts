import type { PropertyPublicLocation, PropertySummary } from '@/types/property';

/**
 * THE ONE PLACE THAT DECIDES WHETHER A LISTING MAY BE DRAWN ON A MAP.
 *
 * ── Why a module and not an inline check ────────────────────────────────
 * The rule this file encodes is a privacy contract, not a formatting
 * preference. It has to hold identically on the Property Details map, on the
 * Properties list map that comes next, and on anything after that — and a rule
 * restated at three call sites is a rule that will eventually be stated three
 * different ways. Written once, it can also be tested once
 * (tests/property-location.test.mjs) without a single pixel being rendered.
 *
 * ── Deliberately mirrors two things that already exist ──────────────────
 * The names and semantics are the website's, from
 * frontend/src/components/PropertyMapView.jsx, which exports
 * `isPubliclyMappable` and `isApproximateLocation` with exactly these meanings.
 * The bounds and the strict number test are the backend's, from
 * `isUsableLat` / `isUsableLng` / `isFiniteNumber` in routes/properties.js.
 * Three codebases, one sentence: approximate wins over coordinates.
 *
 * ── What this file is NOT ───────────────────────────────────────────────
 * There is no distance maths here, no map region maths, no geocoding and no
 * device location. Region derivation belongs to the map component, which is
 * where the zoom decision lives; distance belongs to the Near Me phase, which
 * does not exist yet. This module answers exactly one question about exactly
 * one payload.
 *
 * Pure: no imports beyond a type, no React, no network, no clock.
 */

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

/**
 * A publicly usable latitude.
 *
 * `typeof value === 'number'` FIRST, rather than `Number(value)`, because a
 * numeric string must be refused. The backend refuses one on write and on read
 * for a documented reason — a JSON API that quietly coerces '41.0082' teaches
 * clients to send strings — and a client that silently accepts what the server
 * rejects would place a pin the server considers invalid. `Number.isFinite`
 * then rules out NaN and ±Infinity, which are what survive a hand-edited Mongo
 * record.
 *
 * Takes `unknown` on purpose. The value crosses a network boundary, so its
 * declared type is a claim, not a fact.
 */
export function isUsableLatitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= LAT_MIN && value <= LAT_MAX;
}

/** A publicly usable longitude. Same reasoning as `isUsableLatitude`. */
export function isUsableLongitude(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= LNG_MIN && value <= LNG_MAX;
}

/**
 * True when the owner asked for this listing's exact position to stay private.
 *
 * Read this BEFORE `isPubliclyMappable`, never instead of it: it answers "may I
 * say the location is approximate", which is a display question, while
 * `isPubliclyMappable` answers "may I place a pin". They are not opposites —
 * a listing with no location at all is neither.
 *
 * Strict `=== true`. A truthy string, a 1, or the word "false" arriving from a
 * legacy document must not be read as "yes, it is approximate" by accident, and
 * more importantly `!== true` must not be read as "safe to map" — which is why
 * the mapping check below tests for the flag rather than reusing this one's
 * negation.
 */
export function isApproximateLocation(property: {
  location?: PropertyPublicLocation;
} | null | undefined): boolean {
  return property?.location?.isApproximate === true;
}

/**
 * THE PRIVACY GATE. True only for a listing whose exact coordinate the public
 * is allowed to see AND which is actually usable as a map position.
 *
 * ── The order of the conditions is the whole point ──────────────────────
 * `isApproximate !== true` is tested FIRST and independently of the
 * coordinates. The server already strips lat/lng from an approximate listing,
 * so in a correct payload the coordinate checks would fail anyway — but this
 * client must not depend on that. A legacy document, a hand-edited record, a
 * future regression in `publicLocation()`, or a response replayed from a cache
 * written by an older server could all deliver
 *
 *     { lat: 41, lng: 28, isApproximate: true }
 *
 * and the answer must still be NO. The flag beats the coordinates every time.
 * That is not defensive duplication of a server rule; it is the client
 * refusing to be the weakest link in a promise made to a property owner.
 *
 * A half pair — lat present, lng missing — is also false. Half a coordinate is
 * not a position; treating the missing half as 0 would drop the pin in the Gulf
 * of Guinea.
 */
export function isPubliclyMappable(property: {
  location?: PropertyPublicLocation;
} | null | undefined): boolean {
  const location = property?.location;

  return (
    location?.isApproximate !== true &&
    isUsableLatitude(location?.lat) &&
    isUsableLongitude(location?.lng)
  );
}

/** A validated, ready-to-plot coordinate pair. */
export type PublicCoordinates = {
  latitude: number;
  longitude: number;
};

/**
 * The coordinate a map may plot, or `null` when there is none to plot.
 *
 * Named `latitude` / `longitude` rather than `lat` / `lng` deliberately: those
 * are react-native-maps' field names, so the returned object drops straight
 * into a `<Marker coordinate={...}>` or a region. The rename happens exactly
 * here, at the boundary between the API's vocabulary and the map library's,
 * instead of at every call site.
 *
 * Gated on `isPubliclyMappable`, so it is impossible to obtain coordinates for
 * an approximate listing through this module — including in the later
 * multi-property map, which filters with the same predicate and then reads
 * through this same function.
 */
export function getPublicCoordinates(property: {
  location?: PropertyPublicLocation;
} | null | undefined): PublicCoordinates | null {
  if (!isPubliclyMappable(property)) return null;

  // Narrowed by the guard above; the non-null assertions the compiler would
  // otherwise need are avoided by re-reading through the type guards, which is
  // free at runtime and keeps this function honest under `strict`.
  const { lat, lng } = property!.location!;
  if (!isUsableLatitude(lat) || !isUsableLongitude(lng)) return null;

  return { latitude: lat, longitude: lng };
}

/**
 * How vague an approximate listing is, in kilometres, or `null` when the value
 * is not one the copy should quote.
 *
 * Cosmetic only — it is never an input to whether something may be mapped, and
 * it must never be used to draw a circle whose centre would imply a coordinate
 * the server withheld. The 1-20 range is the backend's own
 * RADIUS_MIN_KM/RADIUS_MAX_KM, so a stored value outside it reads back as
 * nothing rather than as a number a customer would take literally.
 *
 * Declared against PropertySummary's shape so a future list-side "N listings
 * are approximate" summary can reuse it.
 */
export function getApproximateRadiusKm(property: {
  location?: PropertyPublicLocation;
} | null | undefined): number | null {
  if (!isApproximateLocation(property)) return null;

  const radius = property?.location?.approxRadiusKm;
  if (typeof radius !== 'number' || !Number.isFinite(radius)) return null;
  if (radius < 1 || radius > 20) return null;

  return radius;
}

/**
 * Re-exported so callers can type a variable as "the thing these helpers take"
 * without importing PropertySummary purely for its shape. Every function above
 * accepts the wider structural type, which is what lets the same code serve
 * PropertySummary on the list and PropertyDetail on the details screen.
 */
export type MappableProperty = Pick<PropertySummary, 'location'>;
