import type { PropertySummary } from '@/types/property';
import {
  selectMappableProperties,
  type MappablePropertyEntry,
  type PublicCoordinates,
} from '@/utils/property-location';

const EARTH_RADIUS_KM = 6371.0088;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Great-circle distance between two points, in kilometres.
 *
 * The haversine formulation, chosen over the algebraically simpler spherical
 * law of cosines because that one loses catastrophic precision for small
 * separations — `acos` of a value very near 1 — which is exactly the range this
 * feature works in. Haversine is well-conditioned for short distances.
 *
 * Returns a raw, UNROUNDED value. Callers compare it against a radius; rounding
 * first would move the boundary by up to half a unit and make "within 5 km"
 * mean something slightly different from what it says.
 *
 * Non-finite inputs return `NaN`, which every comparison below treats as "not
 * within" — a coordinate that cannot be measured must never be counted as near.
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return NaN;
  }

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  // atan2 rather than asin: stable for antipodal points, where `a` reaches 1
  // and floating point can nudge it just past, making asin return NaN.
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export const NEAR_ME_RADII_KM = [1, 5, 10, 25] as const;

export type NearMeRadiusKm = (typeof NEAR_ME_RADII_KM)[number];

export const DEFAULT_NEAR_ME_RADIUS_KM: NearMeRadiusKm = 5;

/** Narrows an arbitrary number to one of the offered radii. */
export function isNearMeRadius(value: unknown): value is NearMeRadiusKm {
  return (NEAR_ME_RADII_KM as readonly number[]).includes(value as number);
}


export type PropertyWithDistance<T> = {
  property: T;
  coordinates: PublicCoordinates;
  /** Raw and UNROUNDED. Round only for display, never before comparing. */
  distanceKm: number;
};

export const NEAR_ME_FALLBACK_LIMIT = 3;

export function measureMappableProperties<T extends PropertySummary>(
  properties: readonly T[] | null | undefined,
  origin: PublicCoordinates | null | undefined
): PropertyWithDistance<T>[] {
  if (!origin) return [];

  return selectMappableProperties(properties)
    .map(({ property, coordinates }) => ({
      property,
      coordinates,
      distanceKm: haversineDistanceKm(
        origin.latitude,
        origin.longitude,
        coordinates.latitude,
        coordinates.longitude
      ),
    }))
    .filter((entry) => Number.isFinite(entry.distanceKm))
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

/** The result set split by the customer's chosen radius. */
export type NearMeResults<T> = {
  /** `distanceKm <= radiusKm`, nearest first. What "Near Me" honestly means. */
  withinRadius: PropertyWithDistance<T>[];
  /** Everything else that is mappable, nearest first. */
  outsideRadius: PropertyWithDistance<T>[];
 
  closestOutside: PropertyWithDistance<T>[];
};

export function getNearMeResults<T extends PropertySummary>(
  properties: readonly T[] | null | undefined,
  origin: PublicCoordinates | null | undefined,
  radiusKm: number
): NearMeResults<T> {
  const measured = measureMappableProperties(properties, origin);

  const usableRadius = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : null;

  // With no usable radius every measured property counts as within, so the map
  // shows the normal set rather than blanking on a malformed value.
  const withinRadius =
    usableRadius === null ? measured : measured.filter((e) => e.distanceKm <= usableRadius);
  const outsideRadius =
    usableRadius === null ? [] : measured.filter((e) => e.distanceKm > usableRadius);

  return {
    withinRadius,
    outsideRadius,
    closestOutside: outsideRadius.slice(0, NEAR_ME_FALLBACK_LIMIT),
  };
}

export function selectNearbyProperties<T extends PropertySummary>(
  properties: readonly T[] | null | undefined,
  origin: PublicCoordinates | null | undefined,
  radiusKm: number
): MappablePropertyEntry<T>[] {
  if (!origin) return selectMappableProperties(properties);

  return getNearMeResults(properties, origin, radiusKm).withinRadius;
}

/** A react-native-maps region: a centre plus the span visible around it. */
export type MapRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

const KM_PER_DEGREE = (2 * Math.PI * EARTH_RADIUS_KM) / 360;

/**
 * Breathing room around the radius, so the outermost properties are not flush
 * against the screen edge.
 */
const REGION_MARGIN = 1.25;

export function regionForRadius(origin: PublicCoordinates, radiusKm: number): MapRegion {
  const safeRadius = Number.isFinite(radiusKm) && radiusKm > 0 ? radiusKm : DEFAULT_NEAR_ME_RADIUS_KM;
  const diameterKm = safeRadius * 2 * REGION_MARGIN;

  const latitudeDelta = diameterKm / KM_PER_DEGREE;

  const cosLatitude = Math.cos(toRadians(origin.latitude));
  const longitudeDelta = diameterKm / (KM_PER_DEGREE * Math.max(Math.abs(cosLatitude), 0.01));

  return {
    latitude: origin.latitude,
    longitude: origin.longitude,
    latitudeDelta,
    longitudeDelta,
  };
}
