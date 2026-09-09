// The public property-location contract (Map Foundation, phase 1).
//
// This suite exists because the rule it tests is a PRIVACY PROMISE made to a
// property owner, and a privacy promise that is only checked by looking at a
// phone is not checked at all.
//
// It is deliberately pure. The module under test imports nothing but a type,
// which TypeScript erases, so it transpiles and runs with no React, no
// react-native-maps, no network and no rendering harness — unlike the other
// suites here, which need a hooks shim. Nothing below asserts on UI source
// text: whether a marker is 40px or blue is a rendering question, and a test
// that reads component source to answer it breaks on every refactor while
// proving nothing about the coordinates.
//
// The three payload shapes exercised are the three the backend's
// `publicLocation()` in routes/properties.js can emit, plus the malformed and
// legacy shapes it is documented to defend against.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let mod

before(() => {
  const source = fs.readFileSync(path.join(ROOT, 'src/utils/property-location.ts'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const module = { exports: {} }
  // The single import is `import type`, which transpiles away entirely. If a
  // real runtime import is ever added to this module, this throws rather than
  // silently pulling React Native into a pure test.
  const require = (id) => {
    throw new Error(`property-location.ts must stay dependency-free; it imported ${id}`)
  }
  new Function('exports', 'module', 'require', output)(module.exports, module, require)
  mod = module.exports
})

/** A property carrying exactly the given location, and nothing else that matters. */
const withLocation = (location) => ({ _id: 'p1', title: 'Test', district: 'Beylikdüzü', location })

/* ── The exact case: the only one that may be mapped ──────────────────── */

test('an exact, in-range coordinate is publicly mappable', () => {
  // The literal shape the live API returns for property 6a7b6a76…64a1.
  const property = withLocation({
    lat: 41.02653540497668,
    lng: 28.776197433471683,
    isApproximate: false,
    approxRadiusKm: 5,
  })

  assert.equal(mod.isPubliclyMappable(property), true)
  assert.equal(mod.isApproximateLocation(property), false)
  assert.deepEqual(mod.getPublicCoordinates(property), {
    latitude: 41.02653540497668,
    longitude: 28.776197433471683,
  })
})

test('the coordinate is renamed for the map library but never altered', () => {
  // Guards against a well-meaning "normalisation" ever rounding or clamping a
  // real pin. A pin that moves is a wrong pin.
  const property = withLocation({ lat: -33.8688, lng: 151.2093, isApproximate: false })
  assert.deepEqual(mod.getPublicCoordinates(property), {
    latitude: -33.8688,
    longitude: 151.2093,
  })
})

test('the exact boundaries of the coordinate system are inside the range', () => {
  for (const [lat, lng] of [
    [90, 180],
    [-90, -180],
    [0, 0],
  ]) {
    assert.equal(
      mod.isPubliclyMappable(withLocation({ lat, lng, isApproximate: false })),
      true,
      `${lat},${lng} should be mappable`
    )
  }
})

test('isApproximate may be absent on an exact listing', () => {
  // A document written before the flag existed. Absent is not true, so it maps.
  assert.equal(mod.isPubliclyMappable(withLocation({ lat: 41, lng: 28 })), true)
})

/* ── THE RULE THAT MATTERS MOST ───────────────────────────────────────── */

test('an approximate listing is NOT mappable even when coordinates are present', () => {
  // The whole reason this module exists. The server strips lat/lng from an
  // approximate listing — but a legacy document, a hand-edited record, a stale
  // cache or a future regression could still deliver this, and the answer must
  // be NO regardless. The flag beats the coordinates.
  const property = withLocation({ lat: 41, lng: 28, isApproximate: true })

  assert.equal(mod.isPubliclyMappable(property), false)
  assert.equal(mod.getPublicCoordinates(property), null)
  assert.equal(mod.isApproximateLocation(property), true)
})

test('an approximate listing with a full, valid, in-range coordinate is still refused', () => {
  // Same rule stated with data that would otherwise pass every other check —
  // real Istanbul coordinates, correct types, a radius, nothing malformed. The
  // ONLY reason to refuse is the flag.
  const property = withLocation({
    lat: 41.002265438143105,
    lng: 28.626200258731846,
    isApproximate: true,
    approxRadiusKm: 10,
  })

  assert.equal(mod.isPubliclyMappable(property), false)
  assert.equal(mod.getPublicCoordinates(property), null)
})

test('the approximate payload the server actually sends carries no coordinates', () => {
  const property = withLocation({ isApproximate: true, approxRadiusKm: 5 })

  assert.equal(mod.isApproximateLocation(property), true)
  assert.equal(mod.isPubliclyMappable(property), false)
  assert.equal(mod.getPublicCoordinates(property), null)
})

test('only the boolean true means approximate', () => {
  // A truthy string from a legacy record must not be read as the flag — but it
  // must not be read as "safe to map" either, which is why isPubliclyMappable
  // is asserted separately rather than inferred from the negation.
  for (const value of ['true', 1, 'yes', {}]) {
    assert.equal(
      mod.isApproximateLocation(withLocation({ lat: 41, lng: 28, isApproximate: value })),
      false,
      `${JSON.stringify(value)} is not the boolean true`
    )
  }

  // false, null and undefined are all "not approximate", and all map normally.
  for (const value of [false, null, undefined]) {
    assert.equal(mod.isApproximateLocation(withLocation({ lat: 41, lng: 28, isApproximate: value })), false)
    assert.equal(mod.isPubliclyMappable(withLocation({ lat: 41, lng: 28, isApproximate: value })), true)
  }
})

/* ── Absent, in every way it can be absent ────────────────────────────── */

test('a listing with no location key is not mappable and is not approximate', () => {
  // 4 of the 6 live listings. The key is absent entirely, not null, not {}.
  const property = { _id: 'p2', title: 'No location', district: 'Beylikdüzü' }

  assert.equal(mod.isPubliclyMappable(property), false)
  assert.equal(mod.isApproximateLocation(property), false)
  assert.equal(mod.getPublicCoordinates(property), null)
})

test('undefined, null and empty inputs are refused rather than thrown on', () => {
  for (const property of [undefined, null, {}, withLocation(undefined), withLocation(null), withLocation({})]) {
    assert.equal(mod.isPubliclyMappable(property), false)
    assert.equal(mod.isApproximateLocation(property), false)
    assert.equal(mod.getPublicCoordinates(property), null)
  }
})

/* ── Out of range ─────────────────────────────────────────────────────── */

test('a latitude beyond ±90 is refused', () => {
  for (const lat of [200, 90.0001, -90.0001, -500, 91, -91]) {
    assert.equal(
      mod.isPubliclyMappable(withLocation({ lat, lng: 28, isApproximate: false })),
      false,
      `latitude ${lat} must be refused`
    )
    assert.equal(mod.isUsableLatitude(lat), false)
  }
})

test('a longitude beyond ±180 is refused', () => {
  for (const lng of [-500, 181, -181, 180.0001, 1000] ) {
    assert.equal(
      mod.isPubliclyMappable(withLocation({ lat: 41, lng, isApproximate: false })),
      false,
      `longitude ${lng} must be refused`
    )
    assert.equal(mod.isUsableLongitude(lng), false)
  }
})

/* ── Half a pair is not a position ────────────────────────────────────── */

test('a missing longitude makes the listing unmappable', () => {
  // Treating the absent half as 0 would drop the pin in the Gulf of Guinea.
  assert.equal(mod.isPubliclyMappable(withLocation({ lat: 41.0265, isApproximate: false })), false)
  assert.equal(mod.getPublicCoordinates(withLocation({ lat: 41.0265 })), null)
})

test('a missing latitude makes the listing unmappable', () => {
  assert.equal(mod.isPubliclyMappable(withLocation({ lng: 28.7761, isApproximate: false })), false)
  assert.equal(mod.getPublicCoordinates(withLocation({ lng: 28.7761 })), null)
})

/* ── Values that survive a hand-edited record ─────────────────────────── */

test('NaN is refused', () => {
  assert.equal(mod.isUsableLatitude(NaN), false)
  assert.equal(mod.isUsableLongitude(NaN), false)
  assert.equal(mod.isPubliclyMappable(withLocation({ lat: NaN, lng: 28 })), false)
  assert.equal(mod.isPubliclyMappable(withLocation({ lat: 41, lng: NaN })), false)
  assert.equal(mod.isPubliclyMappable(withLocation({ lat: NaN, lng: NaN })), false)
})

test('Infinity is refused', () => {
  for (const value of [Infinity, -Infinity]) {
    assert.equal(mod.isUsableLatitude(value), false)
    assert.equal(mod.isUsableLongitude(value), false)
    assert.equal(mod.isPubliclyMappable(withLocation({ lat: value, lng: 28 })), false)
    assert.equal(mod.isPubliclyMappable(withLocation({ lat: 41, lng: value })), false)
  }
})

test('numeric STRINGS are refused, matching the backend contract', () => {
  // routes/properties.js uses `typeof v === 'number'` rather than Number(v),
  // documented there: a JSON API that quietly coerces '41.0082' teaches clients
  // to send strings. A client that accepted what the server refuses would place
  // a pin the server considers invalid.
  assert.equal(mod.isUsableLatitude('41.0265'), false)
  assert.equal(mod.isUsableLongitude('28.7761'), false)
  assert.equal(
    mod.isPubliclyMappable(withLocation({ lat: '41.0265', lng: '28.7761', isApproximate: false })),
    false
  )
  assert.equal(mod.getPublicCoordinates(withLocation({ lat: '41', lng: '28' })), null)
})

test('other non-numeric types are refused', () => {
  for (const value of [null, undefined, true, false, {}, [], () => 41, '']) {
    assert.equal(mod.isUsableLatitude(value), false, `${typeof value} latitude`)
    assert.equal(mod.isUsableLongitude(value), false, `${typeof value} longitude`)
  }
})

/* ── The cosmetic radius ──────────────────────────────────────────────── */

test('the approximate radius is only reported for an approximate listing', () => {
  assert.equal(mod.getApproximateRadiusKm(withLocation({ isApproximate: true, approxRadiusKm: 10 })), 10)

  // An exact listing also carries approxRadiusKm — the server always sends it —
  // but quoting it there would describe a precise pin as vague.
  assert.equal(
    mod.getApproximateRadiusKm(withLocation({ lat: 41, lng: 28, isApproximate: false, approxRadiusKm: 5 })),
    null
  )
  assert.equal(mod.getApproximateRadiusKm({ _id: 'p3' }), null)
})

test('a radius outside the backend range reads back as nothing', () => {
  // RADIUS_MIN_KM / RADIUS_MAX_KM in routes/properties.js are 1 and 20. A value
  // outside them is not copy a customer should take literally.
  for (const radius of [0, 0.5, 21, 100, -5, NaN, Infinity, '5', null, undefined]) {
    assert.equal(
      mod.getApproximateRadiusKm(withLocation({ isApproximate: true, approxRadiusKm: radius })),
      null,
      `radius ${String(radius)} must not be quoted`
    )
  }

  for (const radius of [1, 5, 20]) {
    assert.equal(mod.getApproximateRadiusKm(withLocation({ isApproximate: true, approxRadiusKm: radius })), radius)
  }
})

/* ── The rule, stated once more against every shape at once ───────────── */

test('across every payload shape, an approximate listing never yields coordinates', () => {
  const approximateShapes = [
    { isApproximate: true },
    { isApproximate: true, approxRadiusKm: 5 },
    { lat: 41, lng: 28, isApproximate: true },
    { lat: 41, lng: 28, isApproximate: true, approxRadiusKm: 20 },
    { lat: 0, lng: 0, isApproximate: true },
    { lat: 90, lng: 180, isApproximate: true },
  ]

  for (const location of approximateShapes) {
    const property = withLocation(location)
    assert.equal(mod.isPubliclyMappable(property), false, JSON.stringify(location))
    assert.equal(mod.getPublicCoordinates(property), null, JSON.stringify(location))
  }
})
