// Reading the phone's language (Phase 10C).
//
// Two concerns: parsing a locale tag correctly, and never letting a missing or
// broken locale API stop the app from starting. Detection runs during startup
// on a device we cannot inspect, so every failure path is exercised here.

import test, { before, beforeEach } from 'node:test'
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
    throw new Error(`unexpected import: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

/** Scripted native constants. */
let nativeConstants = { isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'en_US' }
let nativeThrows = false

const I18nManager = {
  getConstants: () => {
    if (nativeThrows) throw new Error('native module unavailable')
    return nativeConstants
  },
}

/** The real registry shape, minus everything detection does not need. */
const SUPPORTED = [{ code: 'en' }, { code: 'tr' }, { code: 'ar' }, { code: 'de' }, { code: 'ru' }, { code: 'ur' }]

let getRawDeviceLocale
let normalizeLocaleLanguage
let resolveSupportedLanguage

const realIntl = globalThis.Intl

before(() => {
  const mod = load('src/features/localization/device-locale.ts', {
    'react-native': { I18nManager },
  })
  getRawDeviceLocale = mod.getRawDeviceLocale
  normalizeLocaleLanguage = mod.normalizeLocaleLanguage
  resolveSupportedLanguage = mod.resolveSupportedLanguage
})

beforeEach(() => {
  globalThis.Intl = realIntl
  nativeConstants = { isRTL: false, doLeftAndRightSwapInRTL: true, localeIdentifier: 'en_US' }
  nativeThrows = false
})

/** Replaces Intl with one that reports `locale`, or throws if given null. */
const withIntl = (locale) => {
  globalThis.Intl = {
    DateTimeFormat: () => ({
      resolvedOptions: () => {
        if (locale === null) throw new Error('Intl unavailable')
        return { locale }
      },
    }),
  }
}

/* ═══════════════ Normalisation ═══════════════ */

test('1. a region is stripped, with either separator', () => {
  assert.equal(normalizeLocaleLanguage('tr-TR'), 'tr')
  assert.equal(normalizeLocaleLanguage('tr_TR'), 'tr')
  assert.equal(normalizeLocaleLanguage('ar-SA'), 'ar')
  assert.equal(normalizeLocaleLanguage('ar_EG'), 'ar')
  assert.equal(normalizeLocaleLanguage('en-US'), 'en')
  assert.equal(normalizeLocaleLanguage('en_GB'), 'en')
})

test('2. case is normalised', () => {
  assert.equal(normalizeLocaleLanguage('TR-tr'), 'tr')
  assert.equal(normalizeLocaleLanguage('EN_gb'), 'en')
  assert.equal(normalizeLocaleLanguage('AR'), 'ar')
})

test('3. a bare language tag works', () => {
  assert.equal(normalizeLocaleLanguage('tr'), 'tr')
  assert.equal(normalizeLocaleLanguage('  ar  '), 'ar')
})

test('4. a longer tag keeps only the language subtag', () => {
  assert.equal(normalizeLocaleLanguage('zh-Hans-CN'), 'zh')
  assert.equal(normalizeLocaleLanguage('ar-SA-u-nu-arab'), 'ar')
})

test('5. junk is rejected rather than becoming a nonsense code', () => {
  for (const bad of ['', '   ', '-', '_', 'C', 'POSIX', 'undefined', '123', 'a-b', null, undefined, 42, {}]) {
    assert.equal(normalizeLocaleLanguage(bad), null, `input: ${JSON.stringify(bad)}`)
  }
})

/* ═══════════════ Resolution against the registry ═══════════════ */

test('6. supported languages resolve to themselves', () => {
  assert.equal(resolveSupportedLanguage('tr-TR', SUPPORTED, 'en'), 'tr')
  assert.equal(resolveSupportedLanguage('ar-SA', SUPPORTED, 'en'), 'ar')
  assert.equal(resolveSupportedLanguage('en-GB', SUPPORTED, 'en'), 'en')
  assert.equal(resolveSupportedLanguage('de-DE', SUPPORTED, 'en'), 'de')
  assert.equal(resolveSupportedLanguage('de_DE', SUPPORTED, 'en'), 'de')
  assert.equal(resolveSupportedLanguage('de-AT', SUPPORTED, 'en'), 'de')
  assert.equal(resolveSupportedLanguage('de-CH', SUPPORTED, 'en'), 'de')
})

test('6b. every Russian region resolves to the one Russian bundle', () => {
  // Bundles are per-language, not per-region: a Belarusian and a Kazakh
  // Russian speaker read the same strings.
  for (const locale of ['ru-RU', 'ru_RU', 'ru-BY', 'ru-KZ', 'RU-ru', 'ru']) {
    assert.equal(resolveSupportedLanguage(locale, SUPPORTED, 'en'), 'ru', locale)
  }
})

test('6c. every Urdu region resolves to the one Urdu bundle', () => {
  for (const locale of ['ur-PK', 'ur_PK', 'ur-IN', 'UR-pk', 'ur']) {
    assert.equal(resolveSupportedLanguage(locale, SUPPORTED, 'en'), 'ur', locale)
  }
})

test('7. unsupported languages still fall back to English', () => {
  for (const locale of ['ja-JP', 'fr-FR', 'zh-Hans-CN']) {
    assert.equal(resolveSupportedLanguage(locale, SUPPORTED, 'en'), 'en', locale)
  }
})

test('8. an unreadable locale falls back to English', () => {
  for (const bad of [null, undefined, '', '   ', 'garbage!!', 'C']) {
    assert.equal(resolveSupportedLanguage(bad, SUPPORTED, 'en'), 'en', JSON.stringify(bad))
  }
})

test('9. the supported set comes from the caller, not a list in this file', () => {
  const source = fs.readFileSync(
    path.join(ROOT, 'src/features/localization/device-locale.ts'),
    'utf8'
  )

  // A second hard-coded list is exactly the drift Phase 10B removed.
  assert.equal(/\[\s*'en'\s*,\s*'tr'\s*,\s*'ar'\s*\]/.test(source), false)

  // Proof by behaviour: a different registry gives a different answer.
  assert.equal(resolveSupportedLanguage('de-DE', [{ code: 'de' }], 'en'), 'de')
  assert.equal(resolveSupportedLanguage('tr-TR', [{ code: 'en' }], 'en'), 'en')
})

/* ═══════════════ Detection sources ═══════════════ */

test('10. Intl is the primary source', () => {
  withIntl('tr-TR')
  nativeConstants.localeIdentifier = 'en_US' // would disagree if consulted

  assert.equal(getRawDeviceLocale(), 'tr-TR')
})

test('11. the native constant is used when Intl throws', () => {
  withIntl(null)
  nativeConstants.localeIdentifier = 'tr_TR'

  assert.equal(getRawDeviceLocale(), 'tr_TR')
})

test('12. the native constant is used when Intl returns nothing usable', () => {
  for (const useless of ['', '   ', null, undefined, 42]) {
    withIntl(useless)
    nativeConstants.localeIdentifier = 'ar_SA'

    assert.equal(getRawDeviceLocale(), 'ar_SA', `Intl gave ${JSON.stringify(useless)}`)
  }
})

test('13. both sources unavailable yields null, not a throw', () => {
  withIntl(null)
  nativeThrows = true

  assert.doesNotThrow(() => getRawDeviceLocale())
  assert.equal(getRawDeviceLocale(), null)
})

test('14. a missing localeIdentifier (iOS) yields null rather than undefined', () => {
  withIntl(null)
  nativeConstants = { isRTL: false, doLeftAndRightSwapInRTL: true }

  assert.equal(getRawDeviceLocale(), null)
})

test('15. an unreadable device ends up on English, never crashed', () => {
  withIntl(null)
  nativeThrows = true

  assert.equal(resolveSupportedLanguage(getRawDeviceLocale(), SUPPORTED, 'en'), 'en')
})

test('16. detection never mutates native layout direction', () => {
  // Reading the locale must not latch RTL — that would require a restart.
  const source = fs.readFileSync(
    path.join(ROOT, 'src/features/localization/device-locale.ts'),
    'utf8'
  )

  assert.equal(source.includes('forceRTL'), false)
  assert.equal(source.includes('allowRTL'), false)
})
