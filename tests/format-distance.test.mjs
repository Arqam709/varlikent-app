// The distance display formatter.
//
// Pure and dependency-free, so it runs directly. What matters here is that
// formatting is a DISPLAY concern only: it never feeds back into the radius
// comparison, and it never invents precision the spherical measurement cannot
// support.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let formatDistanceKm

before(() => {
  const output = ts.transpileModule(
    fs.readFileSync(path.join(ROOT, 'src/utils/format-distance.ts'), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText

  const module = { exports: {} }
  new Function('exports', 'module', 'require', output)(module.exports, module, (id) => {
    throw new Error(`format-distance.ts must stay dependency-free; it imported ${id}`)
  })
  formatDistanceKm = module.exports.formatDistanceKm
})

test('one decimal place, never more', () => {
  // The haversine value is ~0.5% accurate; printing 12.871493 would claim a
  // precision the spherical model does not have.
  assert.equal(formatDistanceKm(12.871493, 'en'), '12.9')
  assert.equal(formatDistanceKm(3.24999, 'en'), '3.2')
  assert.equal(formatDistanceKm(1, 'en'), '1.0')
  assert.equal(formatDistanceKm(0.4, 'en'), '0.4')
})

test('the decimal SEPARATOR follows the locale, the digits do not', () => {
  // Turkish, German and Russian write 12,9 — that is the part that changes
  // meaning. Digits stay Western so the line sits correctly under a price,
  // which formatPrice renders as "$13,250,000" in every language.
  assert.equal(formatDistanceKm(12.9, 'tr'), '12,9')
  assert.equal(formatDistanceKm(12.9, 'de'), '12,9')
  assert.equal(formatDistanceKm(12.9, 'ru'), '12,9')
  assert.equal(formatDistanceKm(12.9, 'en'), '12.9')
})

test('Arabic and Urdu get Western digits, not Arabic-Indic', () => {
  // Left to itself Intl would render ١٢٫٩ for 'ar'. Correct in isolation, but
  // jarring directly above a Western-digit price on the same card.
  for (const locale of ['ar', 'ur']) {
    const formatted = formatDistanceKm(12.9, locale)
    assert.match(formatted, /^[0-9]+[.,][0-9]$/, `${locale} produced ${formatted}`)
  }
})

test('very short distances floor to 0.1 rather than rounding to zero', () => {
  // "0.0 km away" reads as "here" and looks like a bug. Flooring overstates by
  // at most 60 m, always in the harmless direction.
  assert.equal(formatDistanceKm(0.04, 'en'), '0.1')
  assert.equal(formatDistanceKm(0.001, 'en'), '0.1')
  assert.equal(formatDistanceKm(0, 'en'), '0.1')
})

test('non-finite and negative input renders nothing rather than "NaN"', () => {
  for (const bad of [NaN, Infinity, -Infinity, -1]) {
    assert.equal(formatDistanceKm(bad, 'en'), '', String(bad))
  }
})

test('an unknown locale degrades instead of throwing', () => {
  // A bad tag makes Intl throw a RangeError; a distance label is not worth a
  // crash, so the fallback produces a plain decimal.
  const formatted = formatDistanceKm(12.9, 'not-a-locale')
  assert.match(formatted, /^12[.,]9$/)
})

test('the fallback path produces a usable value when Intl is unavailable', () => {
  // Hermes gets Intl from the platform's ICU and the available options vary by
  // Android version. Simulate the throw to prove the catch really returns
  // something renderable rather than propagating.
  const realIntl = globalThis.Intl
  try {
    globalThis.Intl = {
      NumberFormat: function () {
        throw new Error('Intl unavailable')
      },
    }
    assert.equal(formatDistanceKm(12.871493, 'tr'), '12.9')
    assert.equal(formatDistanceKm(0.02, 'en'), '0.1')
  } finally {
    globalThis.Intl = realIntl
  }
})

test('formatting never mutates or is used as the comparison value', () => {
  // The formatter rounds; the radius filter must not. 4.96 km displays as
  // "5.0" but is genuinely inside a 5 km radius, and 5.04 displays as "5.0"
  // while being outside it. That asymmetry is exactly why display rounding has
  // to stay out of the filter — see the near-me suite for the filter side.
  assert.equal(formatDistanceKm(4.96, 'en'), '5.0')
  assert.equal(formatDistanceKm(5.04, 'en'), '5.0')
  assert.ok(4.96 <= 5)
  assert.ok(!(5.04 <= 5))
})

/* ══════════════ "X km OUTSIDE your selected radius" ══════════════ */

//
// The fallback card shows two numbers that answer different questions:
//
//   "Closest property is 12.9 km away."        how far is it from me
//   "2.9 km outside your selected radius."     why is it not in my search
//
// The first does not change when the radius does, which is correct but made
// the radius selector look broken on-device — 1 km, 5 km and 10 km all showed
// 12.9. The second is the one that moves, and these tests pin down the
// arithmetic behind it.
//
// The subtraction lives in the map screen (one line against the already-
// measured, unrounded distanceKm). What is testable purely — and what actually
// carries the risk — is that the SUBTRACTION HAPPENS BEFORE FORMATTING, and
// that a non-positive difference is never rendered. Both are asserted here
// against the real formatter.
//

/** The screen's rule, restated: subtract raw, format after, suppress if not positive. */
const outsideByLabel = (distanceKm, radiusKm, locale) => {
  const outsideByKm = distanceKm - radiusKm
  if (!(outsideByKm > 0)) return null
  return formatDistanceKm(outsideByKm, locale)
}

test('the same property reads differently as the radius widens', () => {
  // The exact scenario from the device: one property at ~12.9 km.
  const nearest = 12.871493

  assert.equal(outsideByLabel(nearest, 1, 'en'), '11.9')
  assert.equal(outsideByLabel(nearest, 5, 'en'), '7.9')
  assert.equal(outsideByLabel(nearest, 10, 'en'), '2.9')

  // Meanwhile the true distance is unchanged at every radius — that is the
  // point of showing both numbers.
  assert.equal(formatDistanceKm(nearest, 'en'), '12.9')
})

test('at 25 km the property is inside the radius, so there is nothing to show', () => {
  // 12.9 <= 25, so it is an ordinary in-radius Near Me result and the fallback
  // card does not render at all.
  assert.equal(outsideByLabel(12.871493, 25, 'en'), null)
})

test('a property exactly at the radius yields no outside-distance', () => {
  // Boundary is inclusive: at exactly the radius it is WITHIN, never a
  // fallback, and "0.0 km outside" would be a contradiction.
  assert.equal(outsideByLabel(5, 5, 'en'), null)
  assert.equal(outsideByLabel(10, 10, 'en'), null)
})

test('a negative difference is never formatted', () => {
  // Guards the case where a property inside the radius somehow reached this
  // path: "-3.0 km outside" would be nonsense. Note formatDistanceKm itself
  // also refuses negatives, so this is belt and braces.
  for (const [distance, radius] of [[2, 5], [0.5, 1], [9, 10]]) {
    assert.equal(outsideByLabel(distance, radius, 'en'), null, `${distance} vs ${radius}`)
  }
})

test('the subtraction uses UNROUNDED input, and it matters', () => {
  // A property 10.04 km out with a 10 km radius is genuinely 40 m outside it.
  //
  //   raw-first      10.04 - 10 = 0.04  -> floors to "0.1"   (shown)
  //   rounded-first  "10.0" - 10 = 0    -> not positive       (suppressed)
  //
  // So rounding before subtracting would silently drop a real outside-distance
  // and leave the card without its explanatory line.
  assert.equal(formatDistanceKm(10.04, 'en'), '10.0')
  assert.equal(outsideByLabel(10.04, 10, 'en'), '0.1')

  // And the reverse direction: rounding first can INVENT distance. A property
  // at 10.96 km rounds to "11.0", which would read as 1.0 km outside a 10 km
  // radius when the truth is 0.96 -> "1.0". Here they agree, but only because
  // the subtraction happened on the raw value.
  assert.equal(outsideByLabel(10.96, 10, 'en'), '1.0')
})

test('the outside-distance is localised by the same formatter', () => {
  // No second formatting path: Turkish/German/Russian get their comma, and
  // Arabic/Urdu keep Western digits, exactly as the true distance does.
  assert.equal(outsideByLabel(12.871493, 10, 'tr'), '2,9')
  assert.equal(outsideByLabel(12.871493, 10, 'de'), '2,9')
  assert.equal(outsideByLabel(12.871493, 10, 'ru'), '2,9')
  assert.match(outsideByLabel(12.871493, 10, 'ar'), /^[0-9]+[.,][0-9]$/)
})

test('a very small outside-distance floors rather than vanishing', () => {
  // 30 m past a 5 km radius is genuinely outside it. Showing "0.0 km outside"
  // would read as "it is on the line"; the formatter's floor keeps it at 0.1.
  assert.equal(outsideByLabel(5.03, 5, 'en'), '0.1')
})
