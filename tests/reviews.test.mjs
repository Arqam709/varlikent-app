// Client reviews model (features/reviews/reviews.ts).
//
// Home's Client Stories section renders the website's GET /api/reviews
// response. These tests pin how that response is made safe: what is kept, what
// is dropped, and that the app never invents a review when there are none.
//
// Pure: the module has no imports, so it is transpiled and run directly.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const load = (relative) => {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => {
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

let reviews

before(() => {
  reviews = load('src/features/reviews/reviews.ts')
})

/** The live response shape: Mongo document fields included. */
const review = (overrides = {}) => ({
  _id: '6a31ec1d7035026ef0dbd409',
  name: 'Elif Acar',
  role: 'Investment Executive',
  text: 'Exceptional service from search to closing.',
  rating: 5,
  avatar: '',
  visible: true,
  order: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  __v: 0,
  ...overrides,
})

test('keeps only the fields the card shows', () => {
  const [first] = reviews.normalizeReviews({ success: true, reviews: [review()] })
  assert.deepEqual(first, {
    id: '6a31ec1d7035026ef0dbd409',
    name: 'Elif Acar',
    role: 'Investment Executive',
    text: 'Exceptional service from search to closing.',
    rating: 5,
    avatar: '',
  })
})

test('an empty or malformed body yields no reviews — never a made-up fallback', () => {
  assert.deepEqual(reviews.normalizeReviews({ success: true, reviews: [] }), [])
  assert.deepEqual(reviews.normalizeReviews(null), [])
  assert.deepEqual(reviews.normalizeReviews({ reviews: 'nope' }), [])
  assert.deepEqual(reviews.normalizeReviews('<html>'), [])
})

test('drops reviews missing a name or text, and non-object entries', () => {
  const result = reviews.normalizeReviews({
    reviews: [review({ name: '  ' }), review({ text: '' }), null, 'x', review({ _id: 'b', name: 'Can' })],
  })
  assert.deepEqual(result.map((r) => r.name), ['Can'])
})

test('keeps the backend order', () => {
  const result = reviews.normalizeReviews({
    reviews: [review({ _id: 'a', name: 'A' }), review({ _id: 'b', name: 'B' }), review({ _id: 'c', name: 'C' })],
  })
  assert.deepEqual(result.map((r) => r.id), ['a', 'b', 'c'])
})

test('rating is rounded and clamped to whole stars, defaulting to 5', () => {
  const ratings = [4.4, 0, 9, 'five', undefined, 3].map(
    (rating) => reviews.normalizeReviews({ reviews: [review({ rating })] })[0].rating
  )
  assert.deepEqual(ratings, [4, 1, 5, 5, 5, 3])
})

test('only absolute http(s) avatars are kept', () => {
  const avatar = (value) => reviews.normalizeReviews({ reviews: [review({ avatar: value })] })[0].avatar
  assert.equal(avatar('https://res.cloudinary.com/x/a.jpg'), 'https://res.cloudinary.com/x/a.jpg')
  assert.equal(avatar('/uploads/a.jpg'), '')
  assert.equal(avatar('javascript:alert(1)'), '')
  assert.equal(avatar(42), '')
})

test('a review without an _id still gets a stable, unique key', () => {
  const result = reviews.normalizeReviews({
    reviews: [review({ _id: undefined, name: 'A' }), review({ _id: undefined, name: 'B' })],
  })
  assert.deepEqual(result.map((r) => r.id), ['review-0', 'review-1'])
})

test('Home is capped at HOME_REVIEW_LIMIT', () => {
  const many = Array.from({ length: 10 }, (_, i) => review({ _id: String(i) }))
  assert.equal(reviews.normalizeReviews({ reviews: many }).length, reviews.HOME_REVIEW_LIMIT)
  assert.equal(reviews.normalizeReviews({ reviews: many }, 2).length, 2)
})

test('initial falls back gracefully and handles non-Latin names', () => {
  assert.equal(reviews.reviewInitial('elif'), 'E')
  assert.equal(reviews.reviewInitial('  şener'), 'Ş')
  assert.equal(reviews.reviewInitial('أحمد'), 'أ')
  assert.equal(reviews.reviewInitial(''), '')
})
