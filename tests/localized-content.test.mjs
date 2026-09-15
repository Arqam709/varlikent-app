// Backend-authored localized text (features/localization/localized-content.ts).
//
// The website's CMS stores admin content as a plain string (older documents)
// or as { sourceLang, en, tr, ar, de, ru, ur }. The app must show the same text
// the website's localizedText helper would, in the same fallback order:
//
//   requested → English → sourceLang → first usable language → ''
//
// Pure: the module is transpiled and run with no imports.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let lc

before(() => {
  const source = fs.readFileSync(path.join(ROOT, 'src/features/localization/localized-content.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => { throw new Error(`localized-content.ts must not import at runtime: ${id}`) }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  lc = module.exports
})

const full = {
  sourceLang: 'en',
  en: 'Our Story',
  tr: 'Hikayemiz',
  ar: 'قصتنا',
  de: 'Unsere Geschichte',
  ru: 'Наша история',
  ur: 'ہماری کہانی',
}

test('a plain legacy string is returned as-is for every language', () => {
  for (const language of ['en', 'tr', 'ar', 'ur']) {
    assert.equal(lc.resolveLocalizedContent('Our Story', language), 'Our Story')
  }
})

test('the requested language wins when present', () => {
  assert.equal(lc.resolveLocalizedContent(full, 'tr'), 'Hikayemiz')
  assert.equal(lc.resolveLocalizedContent(full, 'de'), 'Unsere Geschichte')
  assert.equal(lc.resolveLocalizedContent(full, 'ru'), 'Наша история')
})

test('RTL languages resolve their own text', () => {
  assert.equal(lc.resolveLocalizedContent(full, 'ar'), 'قصتنا')
  assert.equal(lc.resolveLocalizedContent(full, 'ur'), 'ہماری کہانی')
})

test('a missing requested language falls back to English', () => {
  assert.equal(lc.resolveLocalizedContent({ sourceLang: 'tr', en: 'Our Story', tr: 'Hikayemiz' }, 'ar'), 'Our Story')
})

test('with no English, the source language is next', () => {
  assert.equal(lc.resolveLocalizedContent({ sourceLang: 'tr', tr: 'Hikayemiz', de: 'Geschichte' }, 'ar'), 'Hikayemiz')
})

test('with no English and no usable source, the first usable language is used', () => {
  assert.equal(lc.resolveLocalizedContent({ sourceLang: 'tr', tr: '', ru: 'История', de: 'Geschichte' }, 'ar'), 'Geschichte')
  assert.equal(lc.resolveLocalizedContent({ ur: 'کہانی' }, 'en'), 'کہانی')
})

test('empty and blank strings are skipped at every step', () => {
  assert.equal(lc.resolveLocalizedContent({ sourceLang: 'en', en: '', tr: '   ' }, 'tr'), '')
  assert.equal(lc.resolveLocalizedContent({ en: '   ', tr: 'Hikayemiz' }, 'en'), 'Hikayemiz')
  assert.equal(lc.resolveLocalizedContent('', 'en'), '')
  assert.equal(lc.resolveLocalizedContent('   ', 'en'), '')
})

test('resolved text is trimmed', () => {
  assert.equal(lc.resolveLocalizedContent({ en: '  Our Story\n' }, 'en'), 'Our Story')
})

test('translation-provider warnings are never shown as content', () => {
  const poisoned = { sourceLang: 'en', en: 'Our Story', tr: 'MYMEMORY WARNING: YOU USED ALL AVAILABLE FREE TRANSLATIONS' }
  assert.equal(lc.resolveLocalizedContent(poisoned, 'tr'), 'Our Story')
  assert.equal(lc.resolveLocalizedContent('QUERY LENGTH LIMIT EXCEEDED', 'en'), '')
})

test('malformed values resolve to an empty string and never throw', () => {
  for (const value of [null, undefined, 42, true, [], ['Our Story'], {}, { en: 42 }, { en: null }, { en: { nested: 'x' } }, () => 'x']) {
    assert.equal(lc.resolveLocalizedContent(value, 'en'), '', `${String(value)} produced text`)
  }
})

test('an unsupported requested language behaves like English', () => {
  assert.equal(lc.resolveLocalizedContent(full, 'fr'), 'Our Story')
  assert.equal(lc.resolveLocalizedContent(full, undefined), 'Our Story')
})

test('an odd sourceLang cannot reach non-language keys', () => {
  assert.equal(lc.resolveLocalizedContent({ sourceLang: 'constructor', tr: '' }, 'en'), '')
  assert.equal(lc.resolveLocalizedContent({ sourceLang: 'toString' }, 'en'), '')
})

test('resolution never mutates its input', () => {
  const value = structuredClone(full)
  lc.resolveLocalizedContent(value, 'ar')
  lc.sanitizeLocalizedContent(value)
  assert.deepEqual(value, full)
})

test('sanitising keeps only language strings and a valid sourceLang, as a copy', () => {
  const raw = { _id: 'x', sourceLang: 'tr', en: 'Story', tr: 'Hikaye', fr: 'Histoire', de: 42 }
  const clean = lc.sanitizeLocalizedContent(raw)

  assert.deepEqual(clean, { en: 'Story', tr: 'Hikaye', sourceLang: 'tr' })
  assert.notEqual(clean, raw)
  assert.equal(lc.sanitizeLocalizedContent('Story'), 'Story')
  assert.deepEqual(lc.sanitizeLocalizedContent({ en: 'Story', sourceLang: 'xx' }), { en: 'Story' })
  for (const value of [null, [], 7, {}, { fr: 'Histoire' }, { sourceLang: 'en' }]) {
    assert.equal(lc.sanitizeLocalizedContent(value), null)
  }
})

test('hasLocalizedContent reports whether any language would show text', () => {
  assert.equal(lc.hasLocalizedContent({ sourceLang: 'en', en: '' }), false)
  assert.equal(lc.hasLocalizedContent({ sourceLang: 'en', en: '', ru: 'История' }), true)
  assert.equal(lc.hasLocalizedContent('Story'), true)
  assert.equal(lc.hasLocalizedContent(null), false)
})

test('the six content languages match the app’s six languages', () => {
  assert.deepEqual([...lc.CONTENT_LANGUAGES], ['en', 'tr', 'ar', 'de', 'ru', 'ur'])
})
