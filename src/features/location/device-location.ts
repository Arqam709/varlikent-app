import * as Location from 'expo-location';

import type { PublicCoordinates } from '@/utils/property-location';

export type LocationFailure =
  /** The customer said no, but may be asked again. */
  | 'denied'
  /**
   * Denied AND not askable again — "Don't allow" twice on Android, or Settings
   * on iOS. The only route forward is the OS settings screen, which is why this
   * is a separate outcome rather than a flag on `denied`.
   */
  | 'blocked'
  /** Permission is fine; the device's location services are switched off. */
  | 'services-disabled'
  /** Granted and enabled, but no fix arrived — indoors, airplane mode, timeout. */
  | 'unavailable';

export type LocationResult =
  | { ok: true; coordinates: PublicCoordinates }
  | { ok: false; failure: LocationFailure };

const ACCURACY = Location.Accuracy.Balanced;



function readPermission(
  response: Location.LocationPermissionResponse
): { granted: true } | { granted: false; failure: LocationFailure } {
  if (response.granted) return { granted: true };
  return { granted: false, failure: response.canAskAgain ? 'denied' : 'blocked' };
}


export async function hasForegroundPermission(): Promise<boolean> {
  try {
    const response = await Location.getForegroundPermissionsAsync();
    return response.granted;
  } catch {
    return false;
  }
}


export async function ensureForegroundPermission(): Promise<
  { granted: true } | { granted: false; failure: LocationFailure }
> {
  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) return { granted: true };

    // Not granted and not askable: requesting would resolve instantly with the
    // same denial and no prompt, so report the blocked state instead.
    if (!existing.canAskAgain) return { granted: false, failure: 'blocked' };

    return readPermission(await Location.requestForegroundPermissionsAsync());
  } catch {
    // A throwing permissions API is not something the customer can act on, and
    // it is not a denial — treat it as "could not get a position".
    return { granted: false, failure: 'unavailable' };
  }
}

export async function getCurrentCoordinates(): Promise<LocationResult> {
  const permission = await ensureForegroundPermission();
  if (!permission.granted) return { ok: false, failure: permission.failure };

  try {
    if (!(await Location.hasServicesEnabledAsync())) {
      return { ok: false, failure: 'services-disabled' };
    }
  } catch {
    // If the check itself fails, fall through and let the position attempt
    // decide — it produces the more specific answer.
  }

  try {
    const position = await Location.getCurrentPositionAsync({ accuracy: ACCURACY });
    const { latitude, longitude } = position.coords;

    // The platform can hand back a malformed fix. Validating here means an
    // unusable position becomes an honest error rather than a marker set
    // filtered against NaN, which would silently show zero results.
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return { ok: false, failure: 'unavailable' };
    }

    return { ok: true, coordinates: { latitude, longitude } };
  } catch {
    // Deliberately not logged: see the privacy note at the top of this file.
    return { ok: false, failure: 'unavailable' };
  }
}
