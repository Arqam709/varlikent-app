// Directions hand-off URLs.
//
// What is under test is the one thing that leaves the app: a URL naming a
// destination. It has to name the RIGHT destination — the exact pin, to full
// precision, with its sign — and it has to name nothing else: no origin, no
// title, and nothing at all for a property whose exact location is private.
//
// Pure: map-directions.ts imports only the privacy module (itself type-only).
// No Linking, no Platform, no device. Opening the URL is openFirstAvailable's
// job and already has its own suite (tests/open-external-url.test.mjs).

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
 * Loads map-directions.ts with its ONE permitted runtime dependency.
 *
 * If this module ever imports Linking, Platform or expo-location, the loader
 * throws — which is how a "pure" URL builder would otherwise quietly start
 * touching the device.
 */
let directions

before(() => {
  const locationModule = { exports: {} }
  new Function('exports', 'module', 'require', transpile('src/utils/property-location.ts'))(
    locationModule.exports,
    locationModule,
    (id) => {
      throw new Error(`property-location.ts must stay dependency-free; it imported ${id}`)
    }
  )

  const module = { exports: {} }
  new Function('exports', 'module', 'require', transpile('src/utils/map-directions.ts'))(
    module.exports,
    module,
    (id) => {
      if (id === '@/utils/property-location') return locationModule.exports
      throw new Error(`map-directions.ts may only import the privacy gate; it imported ${id}`)
    }
  )
  directions = module.exports
})

/** The live exact listing (6+2 Duplex, Beylikdüzü). Full stored precision. */
const LIVE = { latitude: 41.02653540497668, longitude: 28.776197433471683 }

const exactProperty = (latitude, longitude) => ({
  _id: 'p1',
  title: '6+2 DUPLEX APARTMENT WITH FULL SEA VIEW & POOL',
  location: { lat: latitude, lng: longitude, isApproximate: false, approxRadiusKm: 5 },
})

/* ══════════════════════ THE URLS ══════════════════════ */

test('Android gets the Google Maps universal Directions URL with the exact destination', () => {
  assert.equal(
    directions.buildDirectionsUrl('android', LIVE),
    'https://www.google.com/maps/dir/?api=1&destination=41.02653540497668%2C28.776197433471683'
  )
})

test('iOS gets the Apple unified Directions URL with the exact destination', () => {
  assert.equal(
    directions.buildDirectionsUrl('ios', LIVE),
    'https://maps.apple.com/directions?destination=41.02653540497668,28.776197433471683&mode=driving'
  )
})

test('iOS uses the unified schema, not the daddr form that broke in iOS 18.4', () => {
  const url = directions.buildDirectionsUrl('ios', LIVE)
  assert.ok(url.startsWith('https://maps.apple.com/directions?'))
  assert.equal(new URL(url).searchParams.has('daddr'), false)
})

test('iOS sets driving because Apple defaults a source-less request to transit', () => {
  assert.equal(new URL(directions.buildDirectionsUrl('ios', LIVE)).searchParams.get('mode'), 'driving')
})

test('Android leaves the travel mode to Google Maps', () => {
  // Google documents that with no travelmode it shows the most relevant modes.
  assert.equal(new URL(directions.buildDirectionsUrl('android', LIVE)).searchParams.has('travelmode'), false)
})

test('any other platform falls back to the browser-openable Google URL', () => {
  for (const platform of ['web', 'windows', 'macos', '']) {
    assert.ok(
      directions.buildDirectionsUrl(platform, LIVE).startsWith('https://www.google.com/maps/dir/'),
      platform
    )
  }
})

/* ══════════════════════ THE DESTINATION IS EXACT ══════════════════════ */

test('the destination decodes to exactly the coordinate that was passed in', () => {
  for (const platform of ['android', 'ios']) {
    const destination = new URL(directions.buildDirectionsUrl(platform, LIVE)).searchParams.get(
      'destination'
    )
    assert.equal(destination, `${LIVE.latitude},${LIVE.longitude}`, platform)
  }
})

test('decimal precision is never truncated or rounded', () => {
  // toFixed(4) would move the pin ~5 m, toFixed(2) ~550 m — a different
  // building. The parsed values must be the identical doubles.
  for (const platform of ['android', 'ios']) {
    const [lat, lng] = new URL(directions.buildDirectionsUrl(platform, LIVE)).searchParams
      .get('destination')
      .split(',')
      .map(Number)

    assert.equal(lat, LIVE.latitude, `${platform} latitude`)
    assert.equal(lng, LIVE.longitude, `${platform} longitude`)
  }
})

test('the sign of each coordinate is preserved', () => {
  // All four hemisphere combinations, so a dropped minus on either axis fails.
  const cases = [
    { latitude: -33.8688197, longitude: 151.2092955 }, // south, east
    { latitude: 40.7127753, longitude: -74.0059728 }, // north, west
    { latitude: -34.6036844, longitude: -58.3815591 }, // south, west
    { latitude: 41.0265354, longitude: 28.7761974 }, // north, east
  ]

  for (const platform of ['android', 'ios']) {
    for (const point of cases) {
      const [lat, lng] = new URL(directions.buildDirectionsUrl(platform, point)).searchParams
        .get('destination')
        .split(',')
        .map(Number)
      assert.equal(lat, point.latitude, `${platform} ${point.latitude}`)
      assert.equal(lng, point.longitude, `${platform} ${point.longitude}`)
    }
  }
})

test('zero is a valid coordinate, not a missing one', () => {
  // Truthiness checks would reject a property on the equator or the meridian.
  for (const platform of ['android', 'ios']) {
    const url = directions.buildDirectionsUrl(platform, { latitude: 0, longitude: 0 })
    assert.ok(url, platform)
    assert.equal(new URL(url).searchParams.get('destination'), '0,0')
  }
})

/* ══════════════════════ NOTHING ELSE LEAVES THE APP ══════════════════════ */

test('no origin is ever included', () => {
  // The maps app starts from the device's location under its OWN permission.
  // Varlikent never reads or sends the customer's position for this feature.
  for (const platform of ['android', 'ios']) {
    const params = new URL(directions.buildDirectionsUrl(platform, LIVE)).searchParams
    for (const origin of ['origin', 'source', 'saddr', 'sll', 'waypoint', 'waypoints']) {
      assert.equal(params.has(origin), false, `${platform} carries ${origin}`)
    }
    // Exactly one coordinate pair in the whole URL.
    assert.equal(params.get('destination').split(',').length, 2)
  }
})

test('no API key is ever included', () => {
  for (const platform of ['android', 'ios']) {
    const url = directions.buildDirectionsUrl(platform, LIVE)
    assert.equal(/key=|AIza/i.test(url), false, platform)
  }
})

test('the property title is never put into the URL, however it is written', () => {
  // Titles contain characters that would need encoding ('+', '&', spaces,
  // Turkish letters) — but the title must not be there AT ALL: a title in the
  // destination turns an exact point into a text search.
  const property = exactProperty(LIVE.latitude, LIVE.longitude)

  for (const platform of ['android', 'ios']) {
    const url = directions.buildPropertyDirectionsUrl(platform, property)
    assert.equal(url.includes('DUPLEX'), false, platform)
    assert.equal(url.includes('POOL'), false, platform)
    assert.equal(/[ &]{2}|\s/.test(url), false, `${platform} contains unencoded whitespace`)

    // Every query value is well-formed and decodes cleanly.
    const parsed = new URL(url)
    assert.equal(parsed.protocol, 'https:')
    for (const [key, value] of parsed.searchParams) {
      assert.equal(decodeURIComponent(encodeURIComponent(value)), value, `${platform} ${key}`)
    }
  }
})

/* ══════════════════════ INVALID INPUT IS REFUSED ══════════════════════ */

test('non-finite and out-of-range coordinates produce no URL', () => {
  const bad = [
    { latitude: NaN, longitude: 28 },
    { latitude: 41, longitude: NaN },
    { latitude: Infinity, longitude: 28 },
    { latitude: 41, longitude: -Infinity },
    { latitude: 90.0001, longitude: 28 },
    { latitude: -91, longitude: 28 },
    { latitude: 41, longitude: 180.5 },
    { latitude: 41, longitude: -500 },
  ]

  for (const platform of ['android', 'ios']) {
    for (const point of bad) {
      assert.equal(directions.buildDirectionsUrl(platform, point), null, `${platform} ${JSON.stringify(point)}`)
    }
  }
})

test('numeric strings and non-numbers produce no URL', () => {
  // Matches the backend: '41.02' is refused, not coerced.
  for (const platform of ['android', 'ios']) {
    for (const point of [
      { latitude: '41.02', longitude: '28.77' },
      { latitude: null, longitude: 28 },
      { latitude: 41, longitude: undefined },
      { latitude: true, longitude: 28 },
      {},
      null,
      undefined,
    ]) {
      assert.equal(directions.buildDirectionsUrl(platform, point), null, `${platform} ${JSON.stringify(point)}`)
    }
  }
})

/* ══════════════════════ THE PRIVACY GATE, AT THE HAND-OFF ══════════════════════ */

test('an exact public property produces a directions URL', () => {
  for (const platform of ['android', 'ios']) {
    const url = directions.buildPropertyDirectionsUrl(platform, exactProperty(LIVE.latitude, LIVE.longitude))
    assert.equal(url, directions.buildDirectionsUrl(platform, LIVE), platform)
  }
})

test('an APPROXIMATE property produces NO URL, even with coordinates present', () => {
  // The hard rule. If this returned a URL, the exact coordinate the owner asked
  // to keep private would be handed to an external app.
  const leaky = {
    _id: 'p2',
    title: 'Private',
    location: { lat: 41.0265, lng: 28.7761, isApproximate: true, approxRadiusKm: 5 },
  }

  for (const platform of ['android', 'ios', 'web']) {
    assert.equal(directions.buildPropertyDirectionsUrl(platform, leaky), null, platform)
  }
})

test('missing and malformed property locations produce no URL', () => {
  const cases = [
    { _id: 'none' },
    { _id: 'empty', location: {} },
    { _id: 'half', location: { lat: 41.02, isApproximate: false } },
    { _id: 'range', location: { lat: 200, lng: 28, isApproximate: false } },
    { _id: 'string', location: { lat: '41', lng: '28', isApproximate: false } },
    { _id: 'server-approx', location: { isApproximate: true, approxRadiusKm: 5 } },
    null,
    undefined,
  ]

  for (const platform of ['android', 'ios']) {
    for (const property of cases) {
      assert.equal(
        directions.buildPropertyDirectionsUrl(platform, property),
        null,
        `${platform} ${JSON.stringify(property)}`
      )
    }
  }
})
