// Property Details — the `description` contract (features/properties/property-detail.ts
// normalizes it; features/localization/localized-content.ts resolves it).
//
// Regression: the backend localizes Property.description at save time
// (models/Property.js → localizedField(), a Mixed field), so GET
// /api/properties/:id returns { sourceLang, en, tr, ar, de, ru, ur } for every
// listing saved since — while older listings still hold a plain string. The
// screen called `property.description?.trim()`, which threw "trim is not a
// function" on the object and took the whole Property Details screen down.
//
// Pure: modules are transpiled and run with their one import provided.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const load = (relative, imports = {}) => {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => {
    if (id in imports) return imports[id]
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

let localized
let detail

before(() => {
  localized = load('src/features/localization/localized-content.ts')
  detail = load('src/features/properties/property-detail.ts', {
    '@/features/localization/localized-content': localized,
  })
})

/** The shape the live API returned for the listing that crashed. */
const LIVE_DESCRIPTION = {
  sourceLang: 'en',
  en: 'Every room, living room, terrace and balcony has a sea view.',
  tr: 'Her oda, oturma odası, teras ve balkon deniz manzaralı.',
  ar: 'تتمتع كل غرفة وغرفة المعيشة والشرفة بإطلالة على البحر.',
  de: 'Jedes Zimmer, Wohnzimmer, Terrasse und Balkon hat Meerblick.',
  ru: 'Из каждой комнаты, гостиной, террасы и балкона открывается вид на море.',
  ur: 'ہر کمرے، رہنے کے کمرے، ٹیرس اور بالکونی سے سمندر کا نظارہ ہے۔',
}

const property = (description) => ({
  _id: '6aab166a5b37e4d6efc646bb',
  title: 'Sea View Villa',
  listingType: 'Sale',
  propertyType: 'Villa',
  price: 1000000,
  district: 'Besiktas',
  beds: 4,
  baths: 3,
  sqm: 300,
  ...(description === undefined ? {} : { description }),
})

const shown = (description, language) =>
  localized.resolveLocalizedContent(detail.normalizePropertyDetail(property(description)).description, language)

// ── The crash itself ─────────────────────────────────────────────────────

test('the live localized description no longer reaches the screen as something .trim() cannot handle', () => {
  const normalized = detail.normalizePropertyDetail(property(LIVE_DESCRIPTION))
  // Still structured (resolved per render, so a language switch needs no refetch)...
  assert.equal(typeof normalized.description, 'object')
  // ...and resolving it always yields a string.
  for (const language of ['tr', 'en', 'ar', 'de', 'ru', 'ur']) {
    assert.equal(typeof localized.resolveLocalizedContent(normalized.description, language), 'string')
  }
})

// ── Languages ────────────────────────────────────────────────────────────

test('Turkish, English and an RTL language each get their own copy', () => {
  assert.equal(shown(LIVE_DESCRIPTION, 'tr'), LIVE_DESCRIPTION.tr)
  assert.equal(shown(LIVE_DESCRIPTION, 'en'), LIVE_DESCRIPTION.en)
  assert.equal(shown(LIVE_DESCRIPTION, 'ar'), LIVE_DESCRIPTION.ar)
  assert.equal(shown(LIVE_DESCRIPTION, 'ur'), LIVE_DESCRIPTION.ur)
})

test('a missing translation falls back to English, then the source language', () => {
  const { tr, ...noTurkish } = LIVE_DESCRIPTION
  assert.ok(tr)
  assert.equal(shown(noTurkish, 'tr'), LIVE_DESCRIPTION.en)

  const turkishOnly = { sourceLang: 'tr', tr: 'Deniz manzaralı villa.' }
  assert.equal(shown(turkishOnly, 'en'), 'Deniz manzaralı villa.')
  assert.equal(shown(turkishOnly, 'ar'), 'Deniz manzaralı villa.')
})

test('a translation-provider warning is never shown', () => {
  const poisoned = { ...LIVE_DESCRIPTION, tr: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' }
  assert.equal(shown(poisoned, 'tr'), LIVE_DESCRIPTION.en)
})

test('an unknown app language resolves like English', () => {
  assert.equal(shown(LIVE_DESCRIPTION, 'xx'), LIVE_DESCRIPTION.en)
})

// ── Legacy and missing data ──────────────────────────────────────────────

test('a legacy plain-string description still shows, in every language', () => {
  const legacy = '  Spacious apartment near the metro.  '
  assert.equal(detail.normalizePropertyDetail(property(legacy)).description, legacy)
  assert.equal(shown(legacy, 'tr'), 'Spacious apartment near the metro.')
  assert.equal(shown(legacy, 'ar'), 'Spacious apartment near the metro.')
})

test('missing, null and empty descriptions resolve to nothing, so the section is omitted', () => {
  assert.equal(shown(undefined, 'tr'), '')
  assert.equal(shown(null, 'tr'), '')
  assert.equal(shown('', 'tr'), '')
  assert.equal(shown('   ', 'en'), '')
  assert.equal(shown({ sourceLang: 'en', en: '', tr: '' }, 'tr'), '')
})

test('malformed shapes are dropped rather than rendered or thrown on', () => {
  for (const bad of [42, true, ['a', 'b'], {}, { foo: 'bar' }, { en: 7 }]) {
    const normalized = detail.normalizePropertyDetail(property(bad))
    assert.equal(normalized.description, null, JSON.stringify(bad))
    assert.equal(localized.resolveLocalizedContent(normalized.description, 'tr'), '')
  }
})

test('only language strings and sourceLang survive normalization', () => {
  const normalized = detail.normalizePropertyDetail(
    property({ ...LIVE_DESCRIPTION, _id: 'x', __v: 0, extra: { nested: true } })
  )
  assert.deepEqual(Object.keys(normalized.description).sort(), ['ar', 'de', 'en', 'ru', 'sourceLang', 'tr', 'ur'])
})

test('a very long description is returned whole, not truncated', () => {
  const long = 'Sea view. '.repeat(500)
  assert.equal(shown({ sourceLang: 'en', en: long }, 'en'), long.trim())
})

// ── Nothing else changes ─────────────────────────────────────────────────

test('every other field passes through untouched, and the input is not mutated', () => {
  const raw = property(LIVE_DESCRIPTION)
  const snapshot = JSON.stringify(raw)
  const normalized = detail.normalizePropertyDetail(raw)

  assert.equal(JSON.stringify(raw), snapshot)
  for (const key of ['_id', 'title', 'listingType', 'propertyType', 'price', 'district', 'beds', 'baths', 'sqm']) {
    assert.equal(normalized[key], raw[key])
  }
})
