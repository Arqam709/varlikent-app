// The query the Properties list hands to the Properties map (Map phase 2).
//
// Two pure modules are under test:
//
//   utils/property-map-filters.ts  serializing the search into route params
//                                  and re-validating it on the way back.
//   utils/property-location.ts     which of a RESULT SET may become markers.
//
// The second one matters most. `selectMappableProperties` is what stands
// between a property owner's "keep my exact address private" and a screen that
// draws a pin on it — and unlike the single-property case, here one bad entry
// in a list of many would be easy to miss by eye on a phone.
//
// Both modules import only types, so they transpile and run with no React, no
// react-native-maps and no rendering harness. Nothing below asserts on
// component source text.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const load = (relative) => {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText

  const module = { exports: {} }
  // Every import in these modules is `import type`, which transpiles away. A
  // real runtime import would throw here rather than silently dragging React
  // Native into a pure test.
  const require = (id) => {
    throw new Error(`${relative} must stay dependency-free; it imported ${id}`)
  }
  new Function('exports', 'module', 'require', output)(module.exports, module, require)
  return module.exports
}

let filters
let location

before(() => {
  filters = load('src/utils/property-map-filters.ts')
  location = load('src/utils/property-location.ts')
})

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

/* ══════════════ THE MAP DATASET — the privacy rule, applied to many ══════════════ */

test('a safe exact property appears in the map dataset with its coordinate', () => {
  const p = property('a', exact(41.02653540497668, 28.776197433471683))
  const entries = location.selectMappableProperties([p])

  assert.equal(entries.length, 1)
  assert.equal(entries[0].property._id, 'a')
  assert.deepEqual(entries[0].coordinates, {
    latitude: 41.02653540497668,
    longitude: 28.776197433471683,
  })
})

test('an APPROXIMATE property is excluded even when coordinates are present', () => {
  // The rule that matters most, now in the many-properties path. The server
  // strips lat/lng from an approximate listing — but a legacy document, a stale
  // cache or a future regression could still deliver this, and the map must
  // still refuse to plot it.
  const entries = location.selectMappableProperties([
    property('a', { lat: 41, lng: 28, isApproximate: true }),
    property('b', { lat: 41, lng: 28, isApproximate: true, approxRadiusKm: 10 }),
    property('c', { isApproximate: true, approxRadiusKm: 5 }),
  ])

  assert.deepEqual(entries, [])
})

test('a property with no location is excluded', () => {
  assert.deepEqual(location.selectMappableProperties([property('a', undefined)]), [])
  assert.deepEqual(location.selectMappableProperties([{ _id: 'b', title: 'No location key' }]), [])
  assert.deepEqual(location.selectMappableProperties([property('c', {})]), [])
})

test('a malformed LATITUDE excludes only that property', () => {
  const entries = location.selectMappableProperties([
    property('bad-high', exact(200, 28)),
    property('bad-low', exact(-91, 28)),
    property('bad-nan', exact(NaN, 28)),
    property('bad-inf', exact(Infinity, 28)),
    property('bad-string', exact('41.02', 28)),
    property('good', exact(41.02, 28.77)),
  ])

  assert.deepEqual(entries.map((e) => e.property._id), ['good'])
})

test('a malformed LONGITUDE excludes only that property', () => {
  const entries = location.selectMappableProperties([
    property('bad-high', exact(41, 181)),
    property('bad-low', exact(41, -500)),
    property('bad-nan', exact(41, NaN)),
    property('bad-inf', exact(41, -Infinity)),
    property('bad-string', exact(41, '28.77')),
    property('good', exact(41.02, 28.77)),
  ])

  assert.deepEqual(entries.map((e) => e.property._id), ['good'])
})

test('half a coordinate pair is excluded', () => {
  const entries = location.selectMappableProperties([
    property('lat-only', { lat: 41.02, isApproximate: false }),
    property('lng-only', { lng: 28.77, isApproximate: false }),
  ])

  assert.deepEqual(entries, [])
})

test('a mixed result set yields exactly the mappable ones, in order', () => {
  // The realistic shape of the live data: a couple of exact listings among
  // several with no location at all.
  const properties = [
    property('exact-1', exact(41.0265, 28.7762)),
    property('none-1', undefined),
    property('approx', { isApproximate: true, approxRadiusKm: 5 }),
    property('none-2', undefined),
    property('exact-2', exact(41.0022, 28.6262)),
  ]

  const entries = location.selectMappableProperties(properties)

  assert.deepEqual(entries.map((e) => e.property._id), ['exact-1', 'exact-2'])
  // API order is newest-first; the markers must not silently reorder relative
  // to the list showing the same results.
  assert.equal(location.countUnmappableProperties(properties), 3)
})

test('the dataset helpers survive empty and malformed input', () => {
  for (const input of [[], null, undefined, 'not an array', 42]) {
    assert.deepEqual(location.selectMappableProperties(input), [])
    assert.equal(location.countUnmappableProperties(input), 0)
  }
})

/* ══════════════ SERIALIZING THE QUERY ══════════════ */

test('the All segment contributes no listingType param', () => {
  // 'All' is the ABSENCE of a listing-type filter, not a value. Sending
  // listingType=All would filter to nothing on the backend.
  assert.deepEqual(filters.toMapParams({ segment: 'All', filters: {} }), {})
})

test('Sale and Rent round-trip', () => {
  for (const segment of ['Sale', 'Rent']) {
    const params = filters.toMapParams({ segment, filters: {} })
    assert.deepEqual(params, { listingType: segment })
    assert.deepEqual(filters.fromMapParams(params), { segment, filters: {} })
  }
})

test('a district round-trips with its Turkish characters intact', () => {
  // The backend matches district EXACTLY and case-sensitively, so any
  // normalisation here would silently match nothing.
  const query = { segment: 'All', filters: { district: 'Beylikdüzü' } }
  const params = filters.toMapParams(query)

  assert.deepEqual(params, { district: 'Beylikdüzü' })
  assert.deepEqual(filters.fromMapParams(params), query)
})

test('every numeric filter round-trips as a number, not a string', () => {
  const query = {
    segment: 'Rent',
    filters: {
      district: 'Büyükçekmece',
      propertyType: 'Villa',
      minPrice: 5000,
      maxPrice: 40000,
      beds: 2,
    },
  }

  const restored = filters.fromMapParams(filters.toMapParams(query))

  assert.deepEqual(restored, query)
  assert.equal(typeof restored.filters.minPrice, 'number')
  assert.equal(typeof restored.filters.beds, 'number')
})

test('zero is preserved rather than dropped as falsy', () => {
  // minPrice 0 and beds 0 are real values somebody selected; `if (value)`
  // would silently discard both.
  const query = { segment: 'All', filters: { minPrice: 0, beds: 0 } }
  assert.deepEqual(filters.fromMapParams(filters.toMapParams(query)), query)
})

test('the featured flag round-trips both ways', () => {
  for (const featured of [true, false]) {
    const query = { segment: 'All', filters: { featured } }
    assert.deepEqual(filters.fromMapParams(filters.toMapParams(query)), query)
  }
})

test('empty and default filters produce an empty param object', () => {
  assert.deepEqual(filters.toMapParams({ segment: 'All', filters: {} }), {})
  assert.deepEqual(filters.fromMapParams({}), { segment: 'All', filters: {} })
})

/* ══════════════ INVALID ROUTE PARAMS NORMALIZE SAFELY ══════════════ */

test('an unknown listingType falls back to All rather than filtering to nothing', () => {
  for (const value of ['All', 'sale', 'RENT', 'Lease', '', '  ', undefined, 42, null]) {
    assert.equal(filters.fromMapParams({ listingType: value }).segment, 'All')
  }
})

test('an unknown propertyType is dropped, not passed through', () => {
  // Passing 'Castle' to the backend would match zero listings and look like a
  // broken map rather than a bad link. Case matters: the backend enum is
  // capitalised, so 'apartment' is not a near-miss to be corrected.
  for (const value of ['Castle', 'apartment', 'APARTMENT', '', '  ']) {
    assert.equal(filters.fromMapParams({ propertyType: value }).filters.propertyType, undefined)
  }
  assert.equal(filters.fromMapParams({ propertyType: 'Villa' }).filters.propertyType, 'Villa')
})

test('surrounding whitespace is trimmed before a param is validated', () => {
  // Deliberate: a hand-typed or hand-edited deep link should not lose a filter
  // to a stray space. Trimming happens BEFORE the enum check, so the value
  // still has to be exactly one of the twelve types afterwards.
  assert.equal(filters.fromMapParams({ propertyType: ' Villa ' }).filters.propertyType, 'Villa')
  assert.equal(filters.fromMapParams({ listingType: ' Rent ' }).segment, 'Rent')
  assert.equal(filters.fromMapParams({ beds: ' 3 ' }).filters.beds, 3)

  // District is trimmed too. It is matched EXACTLY by the backend, so a
  // trailing space would have matched nothing anyway.
  assert.equal(filters.fromMapParams({ district: ' Beylikdüzü ' }).filters.district, 'Beylikdüzü')
})

test('non-numeric and negative numeric params are dropped', () => {
  for (const value of ['abc', '', '  ', 'NaN', 'Infinity', '-1', '-0.5', '1e', undefined]) {
    const { filters: f } = filters.fromMapParams({ minPrice: value, maxPrice: value, beds: value })
    assert.equal(f.minPrice, undefined, `minPrice ${String(value)}`)
    assert.equal(f.maxPrice, undefined, `maxPrice ${String(value)}`)
    assert.equal(f.beds, undefined, `beds ${String(value)}`)
  }
})

test('a repeated param uses its first value instead of crashing', () => {
  // Expo Router types params as `string | string[]`, because a param CAN
  // repeat in a URL. Calling .trim() on the array form would throw.
  const query = filters.fromMapParams({
    listingType: ['Rent', 'Sale'],
    district: ['Beylikdüzü', 'Esenyurt'],
    beds: ['3', '4'],
  })

  assert.equal(query.segment, 'Rent')
  assert.equal(query.filters.district, 'Beylikdüzü')
  assert.equal(query.filters.beds, 3)
})

test('a featured param that is not exactly true/false is ignored', () => {
  for (const value of ['TRUE', 'yes', '1', '', 'False ']) {
    assert.equal(filters.fromMapParams({ featured: value }).filters.featured, undefined)
  }
})

test('junk params never produce a broken query', () => {
  const query = filters.fromMapParams({
    listingType: 'nonsense',
    district: '   ',
    propertyType: 'Mansion',
    minPrice: 'free',
    maxPrice: '-99',
    beds: 'two',
    featured: 'maybe',
    somethingElse: 'ignored',
  })

  assert.deepEqual(query, { segment: 'All', filters: {} })
})

/* ══════════════ THE API SHAPE ══════════════ */

test('the segment is folded into the request filters exactly as the list does it', () => {
  assert.deepEqual(
    filters.toPropertyListFilters({ segment: 'Rent', filters: { district: 'Esenyurt', beds: 2 } }),
    { listingType: 'Rent', district: 'Esenyurt', beds: 2 }
  )

  // 'All' contributes no listingType, so the request URL stays plain.
  assert.deepEqual(
    filters.toPropertyListFilters({ segment: 'All', filters: { beds: 3 } }),
    { beds: 3 }
  )
})

test('the active-filter count matches the list screen badge', () => {
  const count = filters.countActiveFilters

  assert.equal(count({}), 0)
  assert.equal(count({ district: 'Esenyurt' }), 1)
  assert.equal(count({ district: 'Esenyurt', propertyType: 'Villa' }), 2)
  // Price counts ONCE whether one bound is set or both.
  assert.equal(count({ minPrice: 100 }), 1)
  assert.equal(count({ maxPrice: 100 }), 1)
  assert.equal(count({ minPrice: 100, maxPrice: 200 }), 1)
  assert.equal(count({ district: 'X', propertyType: 'Villa', minPrice: 1, beds: 2 }), 4)
  // beds: 0 is a real selection, not an absent one.
  assert.equal(count({ beds: 0 }), 1)
  // featured is not surfaced in the panel, so it does not count toward the badge.
  assert.equal(count({ featured: true }), 0)
})
