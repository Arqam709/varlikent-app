// The language registry and Home localization (Phase 10B).
//
// Two things are under test:
//
//   1. LANGUAGES is the single source of truth — including for direction. The
//      old RTL_LANGUAGES array was a second place to remember, and its failure
//      mode was silent: adding Urdu would have produced a correct picker entry
//      and a left-to-right layout.
//
//   2. Home is localized. Its five child components already used t(); the shell
//      did not, and several accessibility labels were hard-coded English —
//      invisible to a sighted tester and completely broken for an Arabic
//      screen-reader user.
//
// Same harness style as theme-sync.test.mjs: the REAL provider is transpiled and
// run against a minimal hooks implementation. No test framework is installed.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const transpile = (relative, jsx) =>
  ts.transpileModule(read(relative), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(jsx ? { jsx: ts.JsxEmit.React, jsxFactory: '__jsx' } : {}),
    },
  }).outputText

let captured = null

const load = (relative, imports = {}, jsx = false) => {
  const module = { exports: {} }
  const require = (id) => {
    if (id in imports) return imports[id]
    throw new Error(`unexpected import: ${id}`)
  }
  new Function('exports', 'module', 'require', '__jsx', transpile(relative, jsx))(
    module.exports,
    module,
    require,
    (_type, props) => {
      if (props && 'value' in props) captured = props.value
      return null
    }
  )
  return module.exports
}

/* ── Minimal hooks ───────────────────────────────────────────────────── */

let slots = []
let cursor = 0
let pendingEffects = []

const React = {
  createContext: () => ({ Provider: 'Provider' }),
  useState(initial) {
    const i = cursor++
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
    return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
  },
  useRef(initial) {
    const i = cursor++
    if (!(i in slots)) slots[i] = { current: initial }
    return slots[i]
  },
  useCallback: (fn) => fn,
  useMemo: (fn) => fn(),
  useEffect: (fn) => { pendingEffects.push(fn) },
  useContext: () => null,
}

/** Records any attempt to change native layout direction. */
let i18nManagerCalls = []

const I18nManager = {
  isRTL: false,
  allowRTL: (v) => i18nManagerCalls.push(['allowRTL', v]),
  forceRTL: (v) => i18nManagerCalls.push(['forceRTL', v]),
  getConstants: () => ({ isRTL: false, localeIdentifier: 'en_US' }),
}

/* ── Module under test ───────────────────────────────────────────────── */

let stored = null
let storedSource = null
let storedTheme = null
let mod
let resolveSupportedLanguage
let bundles = {}

before(() => {
  for (const code of ['en', 'tr', 'ar', 'de', 'ru']) {
    const m = load(`src/features/localization/translations/${code}.ts`)
    bundles[code] = m[code] ?? m.default
  }

  /*
   * The REAL Phase 10C bootstrap, wired to scripted storage.
   *
   * Using the real module rather than a stub keeps these tests honest about
   * how the provider actually obtains its language. The device locale is
   * pinned to en-US so that a fresh-install path resolves predictably on any
   * machine running the suite.
   */
  const preferences = {
    readStoredLanguage: async () => stored,
    readStoredLanguageSource: async () => storedSource,
    readStoredTheme: async () => storedTheme,
    writeStoredLanguage: async (value) => { stored = value },
    writeStoredLanguageSource: async (value) => { storedSource = value },
  }

  const deviceLocaleModule = load('src/features/localization/device-locale.ts', {
    'react-native': { I18nManager },
  })
  resolveSupportedLanguage = deviceLocaleModule.resolveSupportedLanguage

  const bootstrap = load('src/features/localization/language-bootstrap.ts', {
    '@/features/auth/token-storage': { getToken: async () => null },
    '@/features/preferences/preferences-storage': preferences,
    './device-locale': {
      getRawDeviceLocale: () => 'en-US',
      resolveSupportedLanguage: deviceLocaleModule.resolveSupportedLanguage,
    },
  })

  mod = load(
    'src/features/localization/language-context.tsx',
    {
      react: React,
      'react-native': { I18nManager },
      './language-bootstrap': bootstrap,
      '@/features/preferences/preferences-storage': preferences,
      './translations/en': load('src/features/localization/translations/en.ts'),
      './translations/tr': load('src/features/localization/translations/tr.ts'),
      './translations/ar': load('src/features/localization/translations/ar.ts'),
      './translations/ru': load('src/features/localization/translations/ru.ts'),
      './translations/de': load('src/features/localization/translations/de.ts'),
    },
    true
  )
})

beforeEach(() => {
  slots = []
  captured = null
  stored = null
  storedSource = null
  storedTheme = null
  i18nManagerCalls = []
})

const render = async () => {
  cursor = 0
  pendingEffects = []
  mod.LanguageProvider({ children: null })
  for (const effect of pendingEffects) effect()
  await new Promise((r) => setImmediate(r))
  return captured
}

const settle = async (passes = 3) => {
  let ctx = null
  for (let i = 0; i < passes; i += 1) ctx = await render()
  return ctx
}

/* ═══════════════ The registry ═══════════════ */

test('1. LANGUAGES holds exactly the supported codes, in picker order', () => {
  assert.deepEqual(mod.LANGUAGES.map((l) => l.code), ['en', 'tr', 'ar', 'de', 'ru'])
})

test('2. every entry carries code, native label, englishLabel and rtl', () => {
  for (const entry of mod.LANGUAGES) {
    assert.equal(typeof entry.code, 'string', `${entry.code}: code`)
    assert.ok(entry.label?.length, `${entry.code}: native label`)
    assert.ok(entry.englishLabel?.length, `${entry.code}: englishLabel`)
    assert.equal(typeof entry.rtl, 'boolean', `${entry.code}: rtl must be explicit`)
  }
})

test('3. labels are the languages own names, not English names', () => {
  const byCode = Object.fromEntries(mod.LANGUAGES.map((l) => [l.code, l]))

  assert.equal(byCode.en.label, 'English')
  assert.equal(byCode.tr.label, 'Türkçe', 'not "Turkish"')
  assert.equal(byCode.ar.label, 'العربية', 'not "Arabic"')
  assert.equal(byCode.de.label, 'Deutsch', 'not "German"')
  assert.equal(byCode.ru.label, 'Русский', 'not "Russian"')

  // englishLabel stays English — it is what a screen reader announces.
  assert.equal(byCode.tr.englishLabel, 'Turkish')
  assert.equal(byCode.ar.englishLabel, 'Arabic')
  assert.equal(byCode.de.englishLabel, 'German')
  assert.equal(byCode.ru.englishLabel, 'Russian')
})

test('4. direction is recorded per language', () => {
  const byCode = Object.fromEntries(mod.LANGUAGES.map((l) => [l.code, l]))

  assert.equal(byCode.en.rtl, false)
  assert.equal(byCode.tr.rtl, false)
  assert.equal(byCode.ar.rtl, true)
  assert.equal(byCode.de.rtl, false)
  assert.equal(byCode.ru.rtl, false, 'Russian is left-to-right')
})

test('5. each code appears exactly once', () => {
  const codes = mod.LANGUAGES.map((l) => l.code)
  assert.equal(codes.length, new Set(codes).size)
})

test('6. every registry language has a translation bundle', () => {
  for (const { code } of mod.LANGUAGES) {
    assert.ok(bundles[code], `${code} has no bundle`)
    assert.ok(Object.keys(bundles[code]).length > 0)
  }
})

test('7. getLanguageMeta returns the matching entry', () => {
  for (const entry of mod.LANGUAGES) {
    assert.deepEqual(mod.getLanguageMeta(entry.code), entry)
  }
})

test('7b. device resolution uses the real LANGUAGES registry', () => {
  for (const locale of ['de-DE', 'de_DE', 'de-AT', 'de-CH']) {
    assert.equal(resolveSupportedLanguage(locale, mod.LANGUAGES, 'en'), 'de', locale)
  }
  // Russian resolves because it is IN the registry — no locale special case was
  // added anywhere. Every regional variant maps to the one Russian bundle.
  for (const locale of ['ru-RU', 'ru_RU', 'ru-BY', 'ru-KZ']) {
    assert.equal(resolveSupportedLanguage(locale, mod.LANGUAGES, 'en'), 'ru', locale)
  }

  // Urdu is still unimplemented and must keep falling back.
  assert.equal(resolveSupportedLanguage('ur-PK', mod.LANGUAGES, 'en'), 'en')
  assert.equal(resolveSupportedLanguage('ja-JP', mod.LANGUAGES, 'en'), 'en')
})

/* ═══════════════ RTL derives from the registry ═══════════════ */

test('8. the disconnected RTL_LANGUAGES list is gone from the source', () => {
  // The point of Phase 10B: one list, not two.
  const source = read('src/features/localization/language-context.tsx')
  assert.equal(source.includes('RTL_LANGUAGES: LanguageCode[]'), false)
})

test('8b. direction genuinely DERIVES from the registry, not a parallel list', async () => {
  /*
   * The discriminating test. A grep for the old identifier cannot tell the
   * difference between real derivation and someone re-inlining `['ar']`, so
   * this flips a registry entry at runtime and checks the provider follows.
   *
   * Turkish is chosen precisely because no hard-coded RTL list would ever
   * contain it: if isRTL still says false here, direction is coming from
   * somewhere other than LANGUAGES.
   */
  const turkish = mod.LANGUAGES.find((l) => l.code === 'tr')
  const original = turkish.rtl

  try {
    turkish.rtl = true
    slots = []
    stored = 'tr'

    const ctx = await settle()

    assert.equal(ctx.isRTL, true, 'isRTL ignored the registry — it has its own list somewhere')
  } finally {
    turkish.rtl = original
  }

  // And the registry is left exactly as it was.
  assert.equal(mod.getLanguageMeta('tr').rtl, false)
})

test('9. isRTL matches the registry for every language', async () => {
  for (const entry of mod.LANGUAGES) {
    slots = []
    stored = entry.code

    const ctx = await settle()

    assert.equal(ctx.language, entry.code)
    assert.equal(ctx.isRTL, entry.rtl, `${entry.code} direction must follow its registry entry`)
  }
})

test('10. en, tr, de and ru are LTR; ar is RTL', async () => {
  const results = {}
  for (const code of ['en', 'tr', 'ar', 'de', 'ru']) {
    slots = []
    stored = code
    results[code] = (await settle()).isRTL
  }

  assert.deepEqual(results, { en: false, tr: false, ar: true, de: false, ru: false })
})

test('11. switching German → Arabic → German flips direction with no reload', async () => {
  slots = []
  stored = 'de'
  let ctx = await settle()
  assert.equal(ctx.isRTL, false)

  await ctx.setLanguage('ar')
  ctx = await render()
  assert.equal(ctx.language, 'ar')
  assert.equal(ctx.isRTL, true, 'Arabic must flip direction immediately')

  await ctx.setLanguage('de')
  ctx = await render()
  assert.equal(ctx.language, 'de')
  assert.equal(ctx.isRTL, false, 'German must flip direction back immediately')
})

test('11b. manual German selection persists de with source=user', async () => {
  slots = []
  stored = 'en'
  storedSource = 'device'
  const ctx = await settle()

  await ctx.setLanguage('de')

  assert.equal(stored, 'de')
  assert.equal(storedSource, 'user')
})

test('11c. Russian ↔ Arabic flips direction both ways with no reload', async () => {
  slots = []
  stored = 'ru'
  let ctx = await settle()
  assert.equal(ctx.language, 'ru')
  assert.equal(ctx.isRTL, false, 'Russian is left-to-right')

  await ctx.setLanguage('ar')
  ctx = await render()
  assert.equal(ctx.isRTL, true)

  await ctx.setLanguage('ru')
  ctx = await render()
  assert.equal(ctx.isRTL, false, 'and straight back, with no restart')
})

test('11d. German → Russian stays left-to-right', async () => {
  slots = []
  stored = 'de'
  let ctx = await settle()
  assert.equal(ctx.isRTL, false)

  await ctx.setLanguage('ru')
  ctx = await render()

  assert.equal(ctx.language, 'ru')
  assert.equal(ctx.isRTL, false)
})

test('11e. manual Russian selection persists ru with source=user', async () => {
  slots = []
  stored = 'en'
  storedSource = 'device'
  const ctx = await settle()

  await ctx.setLanguage('ru')

  assert.equal(stored, 'ru')
  assert.equal(storedSource, 'user', 'an explicit choice outranks the phone forever')
})

test('12. switching language never mutates native layout direction', async () => {
  slots = []
  stored = 'en'
  const ctx = await settle()

  i18nManagerCalls = []
  await ctx.setLanguage('ar')
  await render()

  assert.deepEqual(i18nManagerCalls, [], 'no allowRTL/forceRTL — that would need a restart')
})

test('13. needsRestartForRTL reflects a stale native flag, not the chosen language', async () => {
  slots = []
  stored = 'ar'
  const ctx = await settle()

  // I18nManager.isRTL is false in this harness, matching a healthy install.
  assert.equal(ctx.needsRestartForRTL, false, 'choosing Arabic alone must not demand a restart')
})

/* ═══════════════ Stored value handling ═══════════════ */

test('14. a stored language is restored', async () => {
  stored = 'tr'
  const ctx = await settle()
  assert.equal(ctx.language, 'tr')
})

test('15. unknown or absent stored values fall back to English', async () => {
  for (const bad of [null, undefined, '', 'ur', 'nonsense', 'EN', 'RU']) {
    slots = []
    stored = bad

    const ctx = await settle()

    assert.equal(ctx.language, 'en', `stored ${JSON.stringify(bad)} must fall back`)
    assert.equal(ctx.isRTL, false)
  }
})

/* ═══════════════ Translation integrity ═══════════════ */

const leaves = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v, `${p}${k}.`) : [`${p}${k}`]
  )

test('16. every bundle exposes an identical key structure', () => {
  // Driven by whatever bundles exist rather than a hard-coded list, so the next
  // language is covered the moment it is loaded — no test edit required.
  const en = leaves(bundles.en).sort()

  for (const [code, bundle] of Object.entries(bundles)) {
    if (code === 'en') continue
    assert.deepEqual(leaves(bundle).sort(), en, `${code} differs from en`)
  }
})

test('16a. no bundle is missing or has extra keys', () => {
  const en = new Set(leaves(bundles.en))

  for (const [code, bundle] of Object.entries(bundles)) {
    if (code === 'en') continue
    const own = new Set(leaves(bundle))

    assert.deepEqual([...en].filter((k) => !own.has(k)), [], `${code} is missing keys`)
    assert.deepEqual([...own].filter((k) => !en.has(k)), [], `${code} has extra keys`)
  }
})
const placeholders = (value) =>
  [...value.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((match) => match[1]).sort()

test('16b. every placeholder in every language exactly matches English', () => {
  /*
   * The silent killer. A translator who writes {количество} instead of {count}
   * produces a string that looks perfect in review and renders the literal
   * braces to the customer, because interpolation is keyed by the English name.
   */
  for (const key of leaves(bundles.en)) {
    const english = key.split('.').reduce((o, part) => o?.[part], bundles.en)

    for (const [code, bundle] of Object.entries(bundles)) {
      if (code === 'en') continue
      const translated = key.split('.').reduce((o, part) => o?.[part], bundle)

      assert.deepEqual(
        placeholders(translated),
        placeholders(english),
        `${code}: placeholder mismatch at ${key}`
      )
    }
  }
})

test('17. no translation value is empty or undefined', () => {
  for (const [code, bundle] of Object.entries(bundles)) {
    for (const key of leaves(bundle)) {
      const value = key.split('.').reduce((o, part) => o?.[part], bundle)
      assert.equal(typeof value, 'string', `${code}.${key} is not a string`)
      assert.ok(value.trim().length > 0, `${code}.${key} is empty`)
    }
  }
})

test('18. the new Home accessibility keys exist in all four languages', () => {
  const added = [
    'notificationsWithCount',
    'searchA11y',
    'viewAllPropertiesA11y',
    'statPropertiesA11y',
    'statYearsA11y',
    'statDistrictsA11y',
    'statSatisfactionA11y',
  ]

  for (const code of ['en', 'tr', 'ar', 'de', 'ru']) {
    for (const key of added) {
      assert.ok(bundles[code].home?.[key]?.length, `${code} is missing home.${key}`)
    }
  }
})

test('19. the notification count interpolates in every language', async () => {
  for (const code of ['en', 'tr', 'ar', 'de', 'ru']) {
    slots = []
    stored = code

    const ctx = await settle()
    const label = ctx.t('home.notificationsWithCount', { count: '3' })

    assert.ok(label.includes('3'), `${code}: count missing from "${label}"`)
    assert.equal(label.includes('{count}'), false, `${code}: placeholder left unreplaced`)
  }
})

test('20. an unknown key degrades to English, then to the key itself', async () => {
  stored = 'ar'
  const ctx = await settle()

  assert.equal(ctx.t('home.featuredTitle'), bundles.ar.home.featuredTitle)
  assert.equal(ctx.t('nope.not.a.key'), 'nope.not.a.key')
})

/* ═══════════════ Home is localized ═══════════════ */

const HOME_FILES = [
  'src/app/(tabs)/index.tsx',
  'src/components/home/home-hero.tsx',
  'src/components/home/home-discovery.tsx',
  'src/components/home/home-featured-properties.tsx',
  'src/components/home/home-services-preview.tsx',
  'src/components/home/home-stats.tsx',
]

test('21. the hard-coded English accessibility labels are gone from Home', () => {
  const offenders = [
    'Notifications, ',
    '"Search properties. Opens the properties list."',
    '"View all properties"',
    "'500 plus properties'",
    "'98 percent satisfaction'",
  ]

  for (const file of HOME_FILES) {
    const source = read(file)
    for (const phrase of offenders) {
      assert.equal(source.includes(phrase), false, `${file} still contains ${phrase}`)
    }
  }
})

test('22. every Home file goes through the shared localization hook', () => {
  for (const file of HOME_FILES) {
    const source = read(file)
    assert.ok(
      source.includes("from '@/features/localization/language-context'"),
      `${file} does not use the shared hook`
    )
    // Nobody may import a bundle directly and bypass the provider.
    assert.equal(
      source.includes("translations/en"),
      false,
      `${file} imports a bundle directly`
    )
  }
})

test('23. every t() key used in Home resolves in all four languages', () => {
  const keys = new Set()
  for (const file of HOME_FILES) {
    // The lookbehind keeps `Dimensions.get('window')` and similar calls ending
    // in `t(` from being mistaken for a translation lookup.
    for (const m of read(file).matchAll(/(?<![A-Za-z0-9_$.])t\('([a-zA-Z0-9_.]+)'/g)) {
      keys.add(m[1])
    }
  }

  assert.ok(keys.size > 10, `expected many Home keys, found ${keys.size}`)

  for (const key of keys) {
    for (const code of ['en', 'tr', 'ar', 'de', 'ru']) {
      const value = key.split('.').reduce((o, part) => o?.[part], bundles[code])
      assert.equal(typeof value, 'string', `${code} is missing ${key}`)
    }
  }
})

test('24. Home is direction-aware', () => {
  // The shell plus every child that lays out a row.
  const mustBeDirectional = [
    'src/app/(tabs)/index.tsx',
    'src/components/home/home-discovery.tsx',
    'src/components/home/home-featured-properties.tsx',
    'src/components/home/home-services-preview.tsx',
    'src/components/home/home-stats.tsx',
  ]

  for (const file of mustBeDirectional) {
    assert.ok(read(file).includes('isRTL'), `${file} ignores direction`)
  }
})

test('25. the brand wordmark is never reversed or translated', () => {
  const source = read('src/app/(tabs)/index.tsx')

  // RTL flips placement, not the letters of a proper noun.
  assert.ok(source.includes('VARLIKENT'), 'the wordmark must remain literal')
  assert.equal(source.includes("t('home.wordmark')"), false, 'the brand is not translated')
})

test('26. admin-authored property data is never routed through t()', () => {
  const source = read('src/components/home/home-featured-properties.tsx')

  for (const forbidden of ['t(property.title', 't(property.district', 't(property.description']) {
    assert.equal(source.includes(forbidden), false, `${forbidden} — property data is not UI copy`)
  }
})

test('26b. no ordinary Russian key ever falls through to English', async () => {
  /*
   * t() falls back to English so a missing key degrades readably rather than
   * printing "account.title". That safety net also HIDES an untranslated key,
   * so completeness has to be asserted directly: every value the app can look
   * up while Russian is active must come from the Russian bundle.
   */
  slots = []
  stored = 'ru'
  const ctx = await settle()
  assert.equal(ctx.language, 'ru')

  const identical = []

  for (const key of leaves(bundles.en)) {
    const expected = key.split('.').reduce((o, part) => o?.[part], bundles.ru)

    assert.equal(typeof expected, 'string', `ru is missing ${key}`)
    assert.equal(ctx.t(key), expected, `${key} did not resolve from the Russian bundle`)

    // Brand and vendor names legitimately match; anything else matching English
    // is a sign the key was copied rather than translated.
    const english = key.split('.').reduce((o, part) => o?.[part], bundles.en)
    if (expected === english) identical.push(key)
  }

  const allowed = new Set([
    'account.eyebrow',
    'accountInformation.providers.google',
    'accountInformation.providers.microsoft',
    'accountInformation.providers.apple',
    'appearance.themes.default.label',
    'appearance.themes.classic.label',
    'appearance.themes.dark.label',
    'appearance.themes.light.label',
    'appearance.themes.forest.label',
    'password.placeholder',
    'properties.eyebrow',
    'filters.min',
    'auth.apple',
    // The website's Russian keeps a Latin example address too — an email
    // placeholder in Cyrillic would not look like an email address.
    'personalInformation.emailPlaceholder',
  ])

  assert.deepEqual(
    identical.filter((k) => !allowed.has(k)),
    [],
    'these Russian values are still identical to English'
  )

  /*
   * An exact-match check alone misses a value that was reworded but never
   * actually translated. In a Cyrillic bundle the stronger signal is script:
   * a value with letters but no Cyrillic at all is Latin text sitting in the
   * Russian file.
   */
  const latinOnly = []

  for (const key of leaves(bundles.en)) {
    if (allowed.has(key)) continue
    const value = key.split('.').reduce((o, part) => o?.[part], bundles.ru)

    const hasLetters = /\p{L}/u.test(value)
    const hasCyrillic = /\p{Script=Cyrillic}/u.test(value)
    if (hasLetters && !hasCyrillic) latinOnly.push(`${key} = ${value}`)
  }

  assert.deepEqual(latinOnly, [], 'these Russian values contain no Cyrillic at all')
})

test('27. Account language options come from LANGUAGES, including German', () => {
  const source = read('src/app/account/language.tsx')

  assert.ok(source.includes('LANGUAGES.map'))
  assert.equal(source.includes("code: 'de'"), false, 'Account must not duplicate the registry')
  assert.equal(source.includes('Deutsch'), false, 'Account must not hard-code the German row')
  assert.ok(mod.LANGUAGES.some((entry) => entry.code === 'de' && entry.label === 'Deutsch'))
})
