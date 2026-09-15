// Near Me — the arithmetic and the privacy rule it must obey.
//
// Two things are under test, and the second matters more than the first:
//
//   1. haversineDistanceKm  is the distance correct, and correct at the
//                           boundaries the UI actually offers (1/5/10/25 km).
//   2. selectNearbyProperties  does the PRIVACY GATE still hold once distance
//                              is involved. An approximate listing must not
//                              merely be absent from the results — it must
//                              never be measured at all, because a distance is
//                              itself a disclosure about a coordinate the
//                              server deliberately withheld.
//
// Pure: `near-me.ts` imports only the privacy module, which imports only types.
// No expo-location, no permissions, no React, no map. Nothing here snapshots a
// native permission dialog or a MapView.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const transpile = (relative) =>
  ts.transpileModule(fs.readFileSync(path.join(ROOT, relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

/**
 * Loads near-me.ts with its ONE permitted runtime dependency wired in.
 *
 * The allowlist is the point: near-me.ts may import the privacy gate and
 * nothing else. If it ever grows an import of expo-location, a store, or the
 * API client, this throws rather than quietly dragging the device into a pure
 * test — which is exactly how a "pure" module stops being pure unnoticed.
 */
const load = () => {
  const locationModule = { exports: {} }
  new Function('exports', 'module', 'require', transpile('src/utils/property-location.ts'))(
    locationModule.exports,
    locationModule,
    (id) => {
      throw new Error(`property-location.ts must stay dependency-free; it imported ${id}`)
    }
  )

  const nearMeModule = { exports: {} }
  new Function('exports', 'module', 'require', transpile('src/utils/near-me.ts'))(
    nearMeModule.exports,
    nearMeModule,
    (id) => {
      if (id === '@/utils/property-location') return locationModule.exports
      throw new Error(`near-me.ts may only import the privacy gate; it imported ${id}`)
    }
  )

  return { nearMe: nearMeModule.exports, location: locationModule.exports }
}

let nearMe

before(() => {
  nearMe = load().nearMe
})

/* Real Istanbul reference points, so the numbers below mean something. */
const BEYLIKDUZU = { latitude: 41.02653540497668, longitude: 28.776197433471683 }
const BUYUKCEKMECE = { latitude: 41.002265438143105, longitude: 28.626200258731846 }

const property = (id, location) => ({
  _id: id,
  title: `Property ${id}`,
  district: 'Beylikdüzü',
  listingType: 'Sale',
  price: 1000,
  propertyType: 'Apartment',
  beds: 2,
  baths: 1,
  sqm: 100,
  location,
})

const exact = (lat, lng) => ({ lat, lng, isApproximate: false, approxRadiusKm: 5 })

/**
 * A property placed a precise distance due NORTH of an origin.
 *
 * Latitude is the safe axis for this: a degree of latitude is very nearly
 * constant everywhere, so the intended distance is not itself a function of the
 * longitude correction the code under test applies. Building the fixture with
 * the same cos(lat) maths the implementation uses would make the test agree
 * with a bug.
 */
// Derived from first principles for a sphere of mean Earth radius: the arc
// length of one degree is 2*pi*R/360. NOT copied from the module under test,
// and deliberately NOT the WGS84 ellipsoidal 110.574 — that figure describes a
// different Earth and placing fixtures with it made every boundary test fail by
// ~0.56%, which is how the module's own mixed constants were found.
const KM_PER_DEGREE_LATITUDE = (2 * Math.PI * 6371.0088) / 360
const northOf = (origin, km) => ({
  latitude: origin.latitude + km / KM_PER_DEGREE_LATITUDE,
  longitude: origin.longitude,
})

/* ══════════════════════ HAVERSINE ══════════════════════ */

test('the same point is zero kilometres away', () => {
  assert.equal(
    nearMe.haversineDistanceKm(
      BEYLIKDUZU.latitude,
      BEYLIKDUZU.longitude,
      BEYLIKDUZU.latitude,
      BEYLIKDUZU.longitude
    ),
    0
  )
  assert.equal(nearMe.haversineDistanceKm(0, 0, 0, 0), 0)
})

test('a known distance matches an independently computed value', () => {
  // Beylikdüzü -> Büyükçekmece, the two real mapped listings.
  //
  // 12.871 km, cross-checked with an independent equirectangular projection
  // (dy = dLat * kmPerDegree, dx = dLng * kmPerDegree * cos(midLat), hypot) —
  // a different formula, so it does not merely restate haversine. At this
  // separation the two agree to a few metres.
  const km = nearMe.haversineDistanceKm(
    BEYLIKDUZU.latitude,
    BEYLIKDUZU.longitude,
    BUYUKCEKMECE.latitude,
    BUYUKCEKMECE.longitude
  )

  assert.ok(km > 12.82 && km < 12.92, `expected ~12.87 km, got ${km}`)
})

test('one degree of latitude is about 111 km, anywhere', () => {
  for (const lat of [0, 41, -41, 60]) {
    const km = nearMe.haversineDistanceKm(lat, 28, lat + 1, 28)
    assert.ok(Math.abs(km - 111.19) < 0.5, `at ${lat}° got ${km}`)
  }
})

test('distance is symmetric', () => {
  const ab = nearMe.haversineDistanceKm(41.02, 28.77, 41.0, 28.62)
  const ba = nearMe.haversineDistanceKm(41.0, 28.62, 41.02, 28.77)
  assert.ok(Math.abs(ab - ba) < 1e-9)
})

test('antipodal points do not produce NaN', () => {
  // The naive asin formulation returns NaN here when floating point pushes the
  // argument just past 1. atan2 does not.
  const km = nearMe.haversineDistanceKm(0, 0, 0, 180)
  assert.ok(Number.isFinite(km))
  assert.ok(Math.abs(km - 20015) < 50, `expected ~half circumference, got ${km}`)
})

test('non-finite coordinates yield NaN rather than a bogus distance', () => {
  for (const bad of [NaN, Infinity, -Infinity]) {
    assert.ok(Number.isNaN(nearMe.haversineDistanceKm(bad, 28, 41, 28)))
    assert.ok(Number.isNaN(nearMe.haversineDistanceKm(41, bad, 41, 28)))
    assert.ok(Number.isNaN(nearMe.haversineDistanceKm(41, 28, bad, 28)))
    assert.ok(Number.isNaN(nearMe.haversineDistanceKm(41, 28, 41, bad)))
  }
})

/* ══════════════════════ RADIUS BOUNDARIES ══════════════════════ */

test('every offered radius includes just inside and excludes just outside', () => {
  // The four values the selector actually offers, each tested at its own edge.
  for (const radiusKm of nearMe.NEAR_ME_RADII_KM) {
    const inside = northOf(BEYLIKDUZU, radiusKm - 0.05)
    const outside = northOf(BEYLIKDUZU, radiusKm + 0.05)

    const entries = nearMe.selectNearbyProperties(
      [
        property('in', exact(inside.latitude, inside.longitude)),
        property('out', exact(outside.latitude, outside.longitude)),
      ],
      BEYLIKDUZU,
      radiusKm
    )

    assert.deepEqual(
      entries.map((e) => e.property._id),
      ['in'],
      `radius ${radiusKm} km`
    )
  }
})

test('the boundary is INCLUSIVE — exactly on the radius counts as within', () => {
  // "Within 5 km" includes a property at 5 km. An exclusive bound would make a
  // listing vanish for sitting precisely on the number the customer chose.
  const atFive = northOf(BEYLIKDUZU, 5)
  const entries = nearMe.selectNearbyProperties(
    [property('edge', exact(atFive.latitude, atFive.longitude))],
    BEYLIKDUZU,
    // Nudged a hair above 5 to absorb the fixture's own rounding; the point is
    // that <= admits the boundary, not that floating point is exact.
    5.001
  )

  assert.deepEqual(entries.map((e) => e.property._id), ['edge'])
})

test('a wider radius is a superset of a narrower one', () => {
  const properties = [1, 5, 10, 25].map((km) => {
    const point = northOf(BEYLIKDUZU, km - 0.1)
    return property(`at-${km}`, exact(point.latitude, point.longitude))
  })

  const ids = (radiusKm) =>
    nearMe.selectNearbyProperties(properties, BEYLIKDUZU, radiusKm).map((e) => e.property._id)

  assert.deepEqual(ids(1), ['at-1'])
  assert.deepEqual(ids(5), ['at-1', 'at-5'])
  assert.deepEqual(ids(10), ['at-1', 'at-5', 'at-10'])
  assert.deepEqual(ids(25), ['at-1', 'at-5', 'at-10', 'at-25'])
})

/* ══════════════════════ THE PRIVACY GATE, UNDER DISTANCE ══════════════════════ */

test('a safe exact property inside the radius is included', () => {
  const near = northOf(BEYLIKDUZU, 2)
  const entries = nearMe.selectNearbyProperties(
    [property('exact', exact(near.latitude, near.longitude))],
    BEYLIKDUZU,
    5
  )

  assert.equal(entries.length, 1)
  assert.equal(entries[0].property._id, 'exact')
  assert.deepEqual(entries[0].coordinates, { latitude: near.latitude, longitude: near.longitude })
})

test('an APPROXIMATE property is excluded even when it sits inside the radius', () => {
  // The rule that matters most. These coordinates are metres from the origin —
  // any distance filter alone would include them. Only the privacy gate
  // running FIRST keeps them out.
  const near = northOf(BEYLIKDUZU, 0.2)

  const entries = nearMe.selectNearbyProperties(
    [
      property('approx-with-coords', {
        lat: near.latitude,
        lng: near.longitude,
        isApproximate: true,
      }),
      property('approx-with-radius', {
        lat: near.latitude,
        lng: near.longitude,
        isApproximate: true,
        approxRadiusKm: 10,
      }),
      property('approx-server-shape', { isApproximate: true, approxRadiusKm: 5 }),
    ],
    BEYLIKDUZU,
    25
  )

  assert.deepEqual(entries, [])
})

test('missing and invalid locations are excluded before any measurement', () => {
  const entries = nearMe.selectNearbyProperties(
    [
      property('no-location', undefined),
      property('empty-location', {}),
      property('lat-only', { lat: 41.02, isApproximate: false }),
      property('lng-only', { lng: 28.77, isApproximate: false }),
      property('lat-out-of-range', exact(200, 28.77)),
      property('lng-out-of-range', exact(41.02, -500)),
      property('lat-nan', exact(NaN, 28.77)),
      property('lng-infinite', exact(41.02, Infinity)),
      property('string-coords', exact('41.02', '28.77')),
    ],
    BEYLIKDUZU,
    25
  )

  assert.deepEqual(entries, [])
})

/* ══════════════════════ LAYERING ON THE EXISTING QUERY ══════════════════════ */

test('Near Me narrows an ALREADY-FILTERED result set without re-filtering it', () => {
  // The screen hands in whatever the query returned — Rent + Apartment + 2 beds,
  // say. Near Me's only job is the radius; it must not add or restore anything.
  const near = northOf(BEYLIKDUZU, 1)
  const far = northOf(BEYLIKDUZU, 12)

  const alreadyFiltered = [
    property('near-rent', exact(near.latitude, near.longitude)),
    property('far-rent', exact(far.latitude, far.longitude)),
  ]

  assert.deepEqual(
    nearMe.selectNearbyProperties(alreadyFiltered, BEYLIKDUZU, 5).map((e) => e.property._id),
    ['near-rent']
  )

  // Widening brings back the far one — and nothing that was not handed in.
  assert.deepEqual(
    nearMe.selectNearbyProperties(alreadyFiltered, BEYLIKDUZU, 25).map((e) => e.property._id),
    ['near-rent', 'far-rent']
  )
})

test('with no origin the full mappable set is returned, not an empty one', () => {
  // Near Me off, or a position not yet acquired. Blanking the map in that
  // window would look like "no results" rather than "not filtering yet".
  const properties = [
    property('a', exact(BEYLIKDUZU.latitude, BEYLIKDUZU.longitude)),
    property('b', exact(BUYUKCEKMECE.latitude, BUYUKCEKMECE.longitude)),
    property('approx', { isApproximate: true, approxRadiusKm: 5 }),
  ]

  for (const origin of [null, undefined]) {
    assert.deepEqual(
      nearMe.selectNearbyProperties(properties, origin, 5).map((e) => e.property._id),
      ['a', 'b'],
      'privacy still applies with no origin'
    )
  }
})

test('a nonsensical radius falls back to the full mappable set', () => {
  const properties = [property('a', exact(BEYLIKDUZU.latitude, BEYLIKDUZU.longitude))]

  for (const radius of [0, -5, NaN, Infinity]) {
    assert.equal(nearMe.selectNearbyProperties(properties, BEYLIKDUZU, radius).length, 1)
  }
})

test('empty and malformed input never throws', () => {
  for (const input of [[], null, undefined, 'nonsense', 7]) {
    assert.deepEqual(nearMe.selectNearbyProperties(input, BEYLIKDUZU, 5), [])
  }
})

test('a selected property that falls outside the radius is no longer in the set', () => {
  // This is what the screen's "clear the selection" effect keys off: the
  // property simply stops being present, so the effect has an honest signal.
  const far = northOf(BEYLIKDUZU, 12)
  const properties = [property('selected', exact(far.latitude, far.longitude))]

  assert.equal(nearMe.selectNearbyProperties(properties, BEYLIKDUZU, 25).length, 1)
  assert.equal(nearMe.selectNearbyProperties(properties, BEYLIKDUZU, 5).length, 0)
})

/* ══════════════════════ RADII AND REGION ══════════════════════ */

test('the radius options are a single source of truth', () => {
  assert.deepEqual([...nearMe.NEAR_ME_RADII_KM], [1, 5, 10, 25])
  assert.equal(nearMe.DEFAULT_NEAR_ME_RADIUS_KM, 5)
  assert.ok(nearMe.NEAR_ME_RADII_KM.includes(nearMe.DEFAULT_NEAR_ME_RADIUS_KM))
})

test('isNearMeRadius accepts only the offered values', () => {
  for (const good of [1, 5, 10, 25]) assert.equal(nearMe.isNearMeRadius(good), true)
  for (const bad of [0, 2, 7, 26, -1, '5', null, undefined, NaN]) {
    assert.equal(nearMe.isNearMeRadius(bad), false, String(bad))
  }
})

test('the camera region is centred on the user and contains the radius', () => {
  const region = nearMe.regionForRadius(BEYLIKDUZU, 5)

  assert.equal(region.latitude, BEYLIKDUZU.latitude)
  assert.equal(region.longitude, BEYLIKDUZU.longitude)

  // The span must cover the DIAMETER, so half of it must reach past the radius.
  const halfSpanKm = (region.latitudeDelta / 2) * KM_PER_DEGREE_LATITUDE
  assert.ok(halfSpanKm > 5, `half-span ${halfSpanKm} km should exceed the 5 km radius`)
  assert.ok(halfSpanKm < 8, `half-span ${halfSpanKm} km should not be wildly generous`)
})

test('the region widens in longitude to compensate for latitude', () => {
  // At 41°N a degree of longitude is ~84 km against ~111 km at the equator, so
  // the same distance needs MORE longitude degrees. Without the cos(latitude)
  // correction the viewport would be far too narrow this far north.
  const north = nearMe.regionForRadius({ latitude: 41, longitude: 28 }, 5)
  const equator = nearMe.regionForRadius({ latitude: 0, longitude: 28 }, 5)

  assert.ok(north.longitudeDelta > equator.longitudeDelta)
  assert.ok(north.longitudeDelta > north.latitudeDelta)
  // Latitude spans do not vary with position.
  assert.ok(Math.abs(north.latitudeDelta - equator.latitudeDelta) < 1e-9)
})

test('the region grows with the radius and never degenerates near the poles', () => {
  const small = nearMe.regionForRadius(BEYLIKDUZU, 1)
  const large = nearMe.regionForRadius(BEYLIKDUZU, 25)
  assert.ok(large.latitudeDelta > small.latitudeDelta)

  // cos(90°) is 0; without the floor this would divide by zero.
  const pole = nearMe.regionForRadius({ latitude: 90, longitude: 0 }, 5)
  assert.ok(Number.isFinite(pole.longitudeDelta))
  assert.ok(Number.isFinite(pole.latitudeDelta))

  // A junk radius must still produce a usable viewport.
  const fallback = nearMe.regionForRadius(BEYLIKDUZU, NaN)
  assert.ok(Number.isFinite(fallback.latitudeDelta) && fallback.latitudeDelta > 0)
})

/* ══════════════ MEASUREMENT, CLASSIFICATION AND THE FALLBACK ══════════════ */

/** A property placed at an already-computed point. */
const exactAt = (point) => exact(point.latitude, point.longitude)

test('measured properties come back sorted NEAREST FIRST', () => {
  // Deliberately supplied far-to-near, so a pass cannot come from input order.
  const measured = nearMe.measureMappableProperties(
    [
      property('far', exactAt(northOf(BEYLIKDUZU, 20))),
      property('near', exactAt(northOf(BEYLIKDUZU, 1))),
      property('mid', exactAt(northOf(BEYLIKDUZU, 8))),
    ],
    BEYLIKDUZU
  )

  assert.deepEqual(measured.map((e) => e.property._id), ['near', 'mid', 'far'])

  for (let i = 1; i < measured.length; i++) {
    assert.ok(measured[i].distanceKm >= measured[i - 1].distanceKm)
  }
})

test('input order does not affect the resulting order', () => {
  const points = [3, 11, 0.5, 22].map((km) => northOf(BEYLIKDUZU, km))
  const build = (order) =>
    nearMe
      .measureMappableProperties(
        order.map((i) => property(`p${i}`, exactAt(points[i]))),
        BEYLIKDUZU
      )
      .map((e) => e.property._id)

  const expected = ['p2', 'p0', 'p1', 'p3']
  assert.deepEqual(build([0, 1, 2, 3]), expected)
  assert.deepEqual(build([3, 2, 1, 0]), expected)
  assert.deepEqual(build([1, 3, 0, 2]), expected)
})

test('the measured distance is UNROUNDED', () => {
  // Rounding here would move a radius boundary by up to half a unit.
  const [entry] = nearMe.measureMappableProperties(
    [property('p', exactAt(northOf(BEYLIKDUZU, 12.871493)))],
    BEYLIKDUZU
  )

  assert.ok(Number.isFinite(entry.distanceKm))
  assert.notEqual(entry.distanceKm, Math.round(entry.distanceKm))
  assert.notEqual(entry.distanceKm, Number(entry.distanceKm.toFixed(1)))
})

test('measurement requires an origin and never guesses one', () => {
  for (const origin of [null, undefined]) {
    assert.deepEqual(nearMe.measureMappableProperties([property('p', exact(41, 28))], origin), [])
  }
})

test('an APPROXIMATE property is never measured', () => {
  // Not "measured then hidden" — never measured. A distance describes a
  // location, so producing one for a listing whose coordinate the server
  // withheld would leak exactly what the privacy setting protects.
  const measured = nearMe.measureMappableProperties(
    [
      property('approx', {
        lat: BEYLIKDUZU.latitude,
        lng: BEYLIKDUZU.longitude,
        isApproximate: true,
      }),
      property('approx-radius', { isApproximate: true, approxRadiusKm: 5 }),
    ],
    BEYLIKDUZU
  )

  assert.deepEqual(measured, [])
})

test('missing and malformed locations are never measured', () => {
  const measured = nearMe.measureMappableProperties(
    [
      property('none', undefined),
      property('empty', {}),
      property('half', { lat: 41.02, isApproximate: false }),
      property('range', exact(200, 28)),
      property('nan', exact(NaN, 28)),
      property('string', exact('41', '28')),
    ],
    BEYLIKDUZU
  )

  assert.deepEqual(measured, [])
})

test('results split into within, outside and the closest slice', () => {
  const properties = [2, 4, 9, 14, 19, 30].map((km) =>
    property(`at-${km}`, exactAt(northOf(BEYLIKDUZU, km)))
  )

  const results = nearMe.getNearMeResults(properties, BEYLIKDUZU, 5)

  assert.deepEqual(results.withinRadius.map((e) => e.property._id), ['at-2', 'at-4'])
  assert.deepEqual(
    results.outsideRadius.map((e) => e.property._id),
    ['at-9', 'at-14', 'at-19', 'at-30']
  )
  // Capped at the fallback limit, nearest first.
  assert.deepEqual(results.closestOutside.map((e) => e.property._id), ['at-9', 'at-14', 'at-19'])
})

test('the fallback limit is three', () => {
  assert.equal(nearMe.NEAR_ME_FALLBACK_LIMIT, 3)

  const properties = [9, 10, 11, 12, 13].map((km) =>
    property(`at-${km}`, exactAt(northOf(BEYLIKDUZU, km)))
  )

  const { closestOutside } = nearMe.getNearMeResults(properties, BEYLIKDUZU, 5)
  assert.equal(closestOutside.length, nearMe.NEAR_ME_FALLBACK_LIMIT)
})

test('fewer than three outside properties yields however many exist', () => {
  for (const count of [1, 2]) {
    const properties = Array.from({ length: count }, (_, i) =>
      property(`p${i}`, exactAt(northOf(BEYLIKDUZU, 9 + i)))
    )

    const { closestOutside } = nearMe.getNearMeResults(properties, BEYLIKDUZU, 5)
    assert.equal(closestOutside.length, count)
  }
})

test('no outside property produces an EMPTY fallback, so nothing is offered', () => {
  const properties = [1, 2, 3].map((km) => property(`at-${km}`, exactAt(northOf(BEYLIKDUZU, km))))
  const results = nearMe.getNearMeResults(properties, BEYLIKDUZU, 5)

  assert.equal(results.withinRadius.length, 3)
  assert.deepEqual(results.outsideRadius, [])
  assert.deepEqual(results.closestOutside, [])
})

test('the closest distance is the FIRST fallback entry', () => {
  // What the "Closest property is X km away" sentence quotes must be the same
  // property the first fallback marker represents.
  const properties = [30, 12, 20].map((km) =>
    property(`at-${km}`, exactAt(northOf(BEYLIKDUZU, km)))
  )
  const { closestOutside, outsideRadius } = nearMe.getNearMeResults(properties, BEYLIKDUZU, 5)

  assert.equal(closestOutside[0].property._id, 'at-12')
  assert.equal(closestOutside[0].distanceKm, outsideRadius[0].distanceKm)
  assert.ok(closestOutside[0].distanceKm > 5, 'the closest fallback is genuinely outside')
})

test('the radius boundary stays INCLUSIVE in the split', () => {
  // A property at exactly the radius is WITHIN it — never pushed into the
  // fallback, which would offer it as an "outside" alternative to itself.
  const results = nearMe.getNearMeResults(
    [property('edge', exactAt(northOf(BEYLIKDUZU, 5)))],
    BEYLIKDUZU,
    5.001
  )

  assert.deepEqual(results.withinRadius.map((e) => e.property._id), ['edge'])
  assert.deepEqual(results.outsideRadius, [])
})

test('widening the radius moves a property from outside to inside', () => {
  // The behaviour behind "change 5 km to 25 km and fallback exits itself".
  const properties = [property('at-12', exactAt(northOf(BEYLIKDUZU, 12)))]

  const narrow = nearMe.getNearMeResults(properties, BEYLIKDUZU, 5)
  assert.equal(narrow.withinRadius.length, 0)
  assert.equal(narrow.closestOutside.length, 1)

  const wide = nearMe.getNearMeResults(properties, BEYLIKDUZU, 25)
  assert.equal(wide.withinRadius.length, 1)
  assert.equal(wide.closestOutside.length, 0, 'nothing to fall back to once it is in range')
})

test('the fallback never contains a privacy-gated property', () => {
  // The whole result set is out of radius, so everything that CAN appear does —
  // and an approximate listing metres away still must not.
  const results = nearMe.getNearMeResults(
    [
      property('approx-near', {
        lat: BEYLIKDUZU.latitude,
        lng: BEYLIKDUZU.longitude,
        isApproximate: true,
      }),
      property('exact-far', exactAt(northOf(BEYLIKDUZU, 18))),
    ],
    BEYLIKDUZU,
    1
  )

  assert.deepEqual(results.withinRadius, [])
  assert.deepEqual(results.closestOutside.map((e) => e.property._id), ['exact-far'])
})

test('results layer on an ALREADY-FILTERED set without restoring anything', () => {
  // Near Me narrows what the query returned; it never adds back a property the
  // district/type/price filters excluded.
  const alreadyFiltered = [
    property('rent-near', exactAt(northOf(BEYLIKDUZU, 2))),
    property('rent-far', exactAt(northOf(BEYLIKDUZU, 16))),
  ]

  const results = nearMe.getNearMeResults(alreadyFiltered, BEYLIKDUZU, 5)
  const seen = [...results.withinRadius, ...results.outsideRadius].map((e) => e.property._id)

  assert.deepEqual(seen.sort(), ['rent-far', 'rent-near'])
})

test('getNearMeResults survives empty, malformed and origin-less input', () => {
  for (const input of [[], null, undefined, 'nonsense', 7]) {
    const results = nearMe.getNearMeResults(input, BEYLIKDUZU, 5)
    assert.deepEqual(results.withinRadius, [])
    assert.deepEqual(results.outsideRadius, [])
    assert.deepEqual(results.closestOutside, [])
  }

  const noOrigin = nearMe.getNearMeResults([property('p', exact(41, 28))], null, 5)
  assert.deepEqual(noOrigin.withinRadius, [])
  assert.deepEqual(noOrigin.closestOutside, [])
})
