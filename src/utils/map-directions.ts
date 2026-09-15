import type { PropertyPublicLocation } from '@/types/property';
import {
  getPublicCoordinates,
  isUsableLatitude,
  isUsableLongitude,
} from '@/utils/property-location';

/**
 * DIRECTIONS — handing a destination to the platform's maps app.
 *
 * ── What Varlikent does, and what it deliberately does not ──────────────
 * Varlikent says one thing: "take me to latitude X, longitude Y". The maps app
 * decides everything else — where the customer is starting from, the route,
 * traffic, turn-by-turn, walking or driving. So there is no origin here, no
 * route, no travel time and no call to a Google Directions or Routes API. It is
 * a URL hand-off, and it needs no API key and no location permission.
 *
 * ── No origin, ever ─────────────────────────────────────────────────────
 * Neither URL carries a starting point. Both providers document that omitting
 * it starts from the device's current location, which the MAPS app obtains
 * under its OWN permission. That keeps Varlikent entirely out of the trip: the
 * customer's position is never read for this feature, never sent, and never
 * written into a URL that leaves the app.
 *
 * ── Pure ────────────────────────────────────────────────────────────────
 * No Linking and no Platform import. The screen passes `Platform.OS` in and
 * opens the result through `openFirstAvailable`, so every rule below is unit
 * tested without a device (tests/map-directions.test.mjs).
 */

/**
 * ANDROID (and the fallback for any other platform) — Google Maps URLs.
 *
 *   https://www.google.com/maps/dir/?api=1&destination=<lat>%2C<lng>
 *
 * The cross-platform "universal" URL from Google's Maps URLs documentation:
 * "If Google Maps app for Android is installed and active, the URL launches
 * Google Maps in the Maps app... If the Google Maps app is not installed or is
 * disabled, the URL launches Google Maps in a browser." That browser fallback
 * is what makes a single https URL sufficient — it always opens something.
 *
 * Deliberately NOT the native `google.navigation:q=` intent, which skips the
 * route preview and starts turn-by-turn DRIVING immediately. The customer
 * asked for directions, not to be put into a car; the preview lets them pick a
 * mode and look before committing. And not `geo:`, which shows a place, not a
 * route.
 *
 * `travelmode` is omitted on purpose: Google documents that it then "shows one
 * or more of the most relevant modes", which is better than guessing.
 */
const GOOGLE_DIRECTIONS_BASE = 'https://www.google.com/maps/dir/';

/**
 * iOS — Apple's unified Maps URLs (iOS 18.4+).
 *
 *   https://maps.apple.com/directions?destination=<lat>,<lng>&mode=driving
 *
 * NOT the long-documented `https://maps.apple.com/?daddr=<lat>,<lng>`. Apple
 * DTS confirmed on the Developer Forums that coordinates in `daddr` stopped
 * working in iOS 18.4 and pointed to the unified schema instead; before that,
 * `daddr` with coordinates could "alter them to some nearest known entity"
 * rather than route to the exact point. Neither is acceptable for a property.
 *
 * `mode=driving` IS set here, unlike on Android, and that is a documented
 * behaviour difference rather than a preference: Apple states that omitting it
 * makes Maps "display directions using public transit... which might not be
 * practical". For a customer travelling to view a property in a residential
 * district that is the wrong default. The customer can still switch mode inside
 * Apple Maps — this is a starting point, not a selector.
 */
const APPLE_DIRECTIONS_BASE = 'https://maps.apple.com/directions';

/** A destination that has already passed validation. */
type Destination = { latitude: number; longitude: number };

/**
 * A coordinate as text, at FULL precision.
 *
 * `String(number)` produces the shortest decimal that round-trips to the same
 * double, so 41.02653540497668 stays 41.02653540497668. `toFixed` would round
 * the property off its own pin — at 4 decimals by up to ~5 m, at 2 by ~550 m,
 * which is a different building. The sign is preserved because it is part of
 * the number, not something to format.
 */
const coordinateText = (value: number) => String(value);

/**
 * The directions URL for a raw destination, or `null` if it is not a valid
 * position.
 *
 * Validates with the SAME `isUsableLatitude` / `isUsableLongitude` the privacy
 * gate uses, rather than a second copy of the rules — so NaN, ±Infinity,
 * out-of-range values and numeric strings are refused here exactly as they are
 * everywhere else. A `null` is the screen's signal to render no Directions
 * action at all, rather than one that opens a maps app pointed at nowhere.
 *
 * Note that 0 is a valid latitude and longitude. The checks are type and range
 * checks, never truthiness, so a property on the equator is not "missing".
 *
 * @param platform `Platform.OS`. Anything other than `'ios'` gets the Google
 *   universal URL, which opens in a browser where no app exists — the right
 *   answer for web and for any platform added later.
 */
export function buildDirectionsUrl(
  platform: string,
  destination: { latitude: unknown; longitude: unknown } | null | undefined
): string | null {
  if (!destination) return null;
  if (!isUsableLatitude(destination.latitude) || !isUsableLongitude(destination.longitude)) {
    return null;
  }

  const point: Destination = { latitude: destination.latitude, longitude: destination.longitude };
  const lat = coordinateText(point.latitude);
  const lng = coordinateText(point.longitude);

  if (platform === 'ios') {
    // Apple's own documented examples write the pair with a literal comma
    // (`destination=40.596896,-73.514907`), so it is left unencoded here to
    // match them exactly. Digits, '.', '-' and ',' need no escaping in a query.
    return `${APPLE_DIRECTIONS_BASE}?destination=${lat},${lng}&mode=driving`;
  }

  // Google's documentation says the comma "must be URL-encoded" as %2C, which
  // encodeURIComponent does. The digits, '.' and '-' pass through unchanged.
  return `${GOOGLE_DIRECTIONS_BASE}?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}`;
}

/**
 * The directions URL for a PROPERTY — the only entry point the UI should use.
 *
 * ── The privacy gate is structural here ─────────────────────────────────
 * The coordinate is obtained through `getPublicCoordinates`, which is gated on
 * `isPubliclyMappable`. So an approximate listing yields `null` — no URL, and
 * therefore nothing containing a coordinate can ever be handed to an external
 * app — even if malformed public data still carries lat/lng. There is no way to
 * build a directions URL for a property from this module without passing that
 * gate first.
 *
 * ── Why the property's title is NOT in the URL ──────────────────────────
 * Neither directions endpoint accepts a display label alongside a coordinate.
 * Putting the title INTO `destination` would turn an exact point into a text
 * search, and the maps app would geocode "6+2 DUPLEX APARTMENT…" to whatever
 * it found — not this property. The exact coordinate is the destination; the
 * maps app shows the address it resolves there.
 */
export function buildPropertyDirectionsUrl(
  platform: string,
  property: { location?: PropertyPublicLocation } | null | undefined
): string | null {
  return buildDirectionsUrl(platform, getPublicCoordinates(property));
}
