// First-launch language decision and safe migration (Phase 10C).
//
// The feature is small; the risk is not. Detection that runs where it should
// not means an existing customer opens an app they have used in English for
// months and finds it in Turkish, having changed nothing. Most of this file
// exists to pin down when detection must NOT happen.
//
// The real bootstrap runs. Storage, the auth token and the raw device locale
// are scripted, so every branch is reachable deterministically — no device, no
// AsyncStorage, and nothing destructive.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const load = (relative, imports = {}) => {
  const { outputText } = ts.transpileModule(read(relative), {
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

/** The registry, as the provider passes it. */
const SUPPORTED = [{ code: 'en' }, { code: 'tr' }, { code: 'ar' }, { code: 'de' }]

/* ── Scripted device ─────────────────────────────────────────────────── */

let deviceLocale = 'en-US'

/* ── Scripted storage ────────────────────────────────────────────────── */

let store = {}
let token = null
let tokenThrows = false
let writesFail = false
let writes = []

const storage = {
  readStoredLanguage: async () => store.language ?? null,
  readStoredLanguageSource: async () => store.source ?? null,
  readStoredTheme: async () => store.theme ?? null,
  writeStoredLanguage: async (v) => {
    writes.push(['language', v])
    if (!writesFail) store.language = v
  },
  writeStoredLanguageSource: async (v) => {
    writes.push(['source', v])
    if (!writesFail) store.source = v
  },
}

let resolveInitialLanguage

before(() => {
  // The REAL registry resolution; only the raw locale is scripted.
  const realDeviceLocale = load('src/features/localization/device-locale.ts', {
    'react-native': { I18nManager: { getConstants: () => ({}) } },
  })

  const mod = load('src/features/localization/language-bootstrap.ts', {
    '@/features/auth/token-storage': {
      getToken: async () => {
        if (tokenThrows) throw new Error('keystore locked')
        return token
      },
    },
    '@/features/preferences/preferences-storage': storage,
    './device-locale': {
      getRawDeviceLocale: () => deviceLocale,
      resolveSupportedLanguage: realDeviceLocale.resolveSupportedLanguage,
    },
  })

  resolveInitialLanguage = mod.resolveInitialLanguage
})

beforeEach(() => {
  store = {}
  token = null
  tokenThrows = false
  writesFail = false
  writes = []
  deviceLocale = 'en-US'
})

const boot = () => resolveInitialLanguage({ supported: SUPPORTED, fallback: 'en' })

/* ═══════════════ Fresh install ═══════════════ */

test('1. fresh + Turkish phone starts in Turkish', async () => {
  deviceLocale = 'tr-TR'

  const result = await boot()

  assert.deepEqual(result, { language: 'tr', source: 'device' })
  assert.equal(store.language, 'tr', 'persisted so it is decided once')
  assert.equal(store.source, 'device')
})

test('2. fresh + Arabic phone starts in Arabic', async () => {
  deviceLocale = 'ar-SA'

  assert.deepEqual(await boot(), { language: 'ar', source: 'device' })
})

test('3. fresh + English phone starts in English', async () => {
  deviceLocale = 'en-GB'

  assert.deepEqual(await boot(), { language: 'en', source: 'device' })
})

test('4. fresh + German phone starts in German as an LTR device choice', async () => {
  for (const locale of ['de-DE', 'de_DE', 'de-AT', 'de-CH']) {
    store = {}
    deviceLocale = locale

    const result = await boot()

    assert.deepEqual(result, { language: 'de', source: 'device' }, locale)
    assert.equal(store.language, 'de')
    assert.equal(store.source, 'device')
  }
})

test('4b. fresh + an unsupported language starts in English', async () => {
  for (const locale of ['ru-RU', 'ur-PK', 'ja-JP']) {
    store = {}
    deviceLocale = locale

    const result = await boot()

    assert.deepEqual(result, { language: 'en', source: 'device' }, locale)
  }
})

test('5. fresh + unreadable locale starts in English without crashing', async () => {
  deviceLocale = null

  assert.deepEqual(await boot(), { language: 'en', source: 'device' })
})

/* ═══════════════ An existing stored choice always wins ═══════════════ */

test('6. stored English on a Turkish phone stays English', async () => {
  store = { language: 'en' }
  deviceLocale = 'tr-TR'

  const result = await boot()

  assert.equal(result.language, 'en', 'the phone must not override a real choice')
  assert.equal(result.source, 'user')
})

test('6b. existing en/device on a German phone stays English/device', async () => {
  store = { language: 'en', source: 'device' }
  deviceLocale = 'de-DE'

  assert.deepEqual(await boot(), { language: 'en', source: 'device' })
})

test('6c. existing en/user on a German phone stays English/user', async () => {
  store = { language: 'en', source: 'user' }
  deviceLocale = 'de-DE'

  assert.deepEqual(await boot(), { language: 'en', source: 'user' })
})

test('7. stored Turkish on an English phone stays Turkish', async () => {
  store = { language: 'tr' }
  deviceLocale = 'en-US'

  assert.equal((await boot()).language, 'tr')
})

test('8. stored Arabic on an English phone stays Arabic', async () => {
  store = { language: 'ar' }
  deviceLocale = 'en-US'

  assert.equal((await boot()).language, 'ar')
})

test('9. a pre-10C stored language gains a "user" marker without changing', async () => {
  // It could only have been written by setLanguage, so it was deliberate.
  store = { language: 'ar' }
  deviceLocale = 'tr-TR'

  const result = await boot()

  assert.deepEqual(result, { language: 'ar', source: 'user' })
  assert.deepEqual(writes, [['source', 'user']], 'the language itself is never rewritten')
})

/* ═══════════════ Legacy installs are grandfathered ═══════════════ */

test('10. a stored THEME alone proves the install is not fresh', async () => {
  store = { theme: 'classic' }
  deviceLocale = 'tr-TR'

  const result = await boot()

  assert.deepEqual(result, { language: 'en', source: 'legacy' })
  assert.equal(store.language, 'en')
})

test('11. an AUTH TOKEN alone proves the install is not fresh', async () => {
  token = 'jwt.from.a.previous.session'
  deviceLocale = 'ar-SA'

  const result = await boot()

  assert.deepEqual(result, { language: 'en', source: 'legacy' })
})

test('12. grandfathering holds for every device language', async () => {
  for (const locale of ['tr-TR', 'ar-SA', 'de-DE', 'en-US']) {
    store = { theme: 'default' }
    deviceLocale = locale

    const result = await boot()

    assert.equal(result.language, 'en', `${locale} must not flip an existing install`)
    assert.equal(result.source, 'legacy')
  }
})

test('13. the auth token is read as evidence only — never mutated', async () => {
  token = 'jwt'
  const source = read('src/features/localization/language-bootstrap.ts')

  for (const forbidden of ['saveToken', 'removeToken', 'deleteItemAsync', 'fetch(']) {
    assert.equal(source.includes(forbidden), false, `bootstrap must not call ${forbidden}`)
  }

  await boot()
  assert.equal(token, 'jwt', 'the token is untouched')
})

test('14. an unreadable keystore is not treated as evidence, and does not throw', async () => {
  tokenThrows = true
  deviceLocale = 'tr-TR'

  const result = await boot()

  // No evidence found, so this is a fresh install as far as we can tell.
  assert.equal(result.source, 'device')
  assert.equal(result.language, 'tr')
})

/* ═══════════════ Corrupt storage ═══════════════ */

test('15. a corrupt stored language is not honoured, and blocks detection', async () => {
  // Only the app writes this key, so residue means the app has run before.
  // Holding at English beats surprising someone with a new language.
  store = { language: 'xx' }
  deviceLocale = 'tr-TR'

  const result = await boot()

  assert.equal(result.language, 'en')
  assert.equal(result.source, 'legacy')
})

test('16. a corrupt source marker recovers deterministically', async () => {
  store = { source: 'garbage' }
  deviceLocale = 'tr-TR'

  const result = await boot()

  assert.equal(result.language, 'en')
  assert.equal(result.source, 'legacy')
  assert.equal(store.source, 'legacy', 'the bad marker is replaced')
})

test('17. a corrupt language with a valid marker keeps the marker', async () => {
  store = { language: 'xx', source: 'user' }
  deviceLocale = 'tr-TR'

  const result = await boot()

  assert.equal(result.language, 'en', 'unrecoverable choice degrades to English')
  assert.equal(result.source, 'user', 'but we still know they had chosen')
})

test('18. an initialised install with a missing language never re-detects', async () => {
  store = { source: 'device' }
  deviceLocale = 'ar-SA'

  const result = await boot()

  assert.equal(result.language, 'en', 'initialisation happened once already')
  assert.equal(result.source, 'device')
})

test('19. corrupt storage never loops — a second launch is stable', async () => {
  store = { language: 'xx', source: 'garbage' }
  deviceLocale = 'tr-TR'

  const first = await boot()
  writes = []
  const second = await boot()

  assert.deepEqual(second, first, 'the second launch agrees with the first')
  assert.deepEqual(writes, [], 'and writes nothing further')
})

/* ═══════════════ One-time initialisation ═══════════════ */

test('20. the second launch reuses the stored decision', async () => {
  deviceLocale = 'tr-TR'
  const first = await boot()
  assert.deepEqual(first, { language: 'tr', source: 'device' })

  writes = []
  const second = await boot()

  assert.deepEqual(second, { language: 'tr', source: 'device' })
  assert.deepEqual(writes, [], 'nothing is written again')
})

test('21. changing the phone language later does NOT move the app', async () => {
  // Detection is first-initialisation behaviour, not a follow-the-system mode.
  deviceLocale = 'tr-TR'
  await boot()

  deviceLocale = 'en-US'
  assert.equal((await boot()).language, 'tr', 'the app stays where it was')

  deviceLocale = 'ar-SA'
  assert.equal((await boot()).language, 'tr')
})

test('22. a manual choice permanently beats the detected one', async () => {
  // The single most important guarantee in this phase.
  deviceLocale = 'tr-TR'
  assert.equal((await boot()).language, 'tr')

  // The customer opens Account → Language and picks English. This is what
  // setLanguage persists.
  await storage.writeStoredLanguage('en')
  await storage.writeStoredLanguageSource('user')

  // Restart, phone still Turkish.
  const afterRestart = await boot()

  assert.deepEqual(afterRestart, { language: 'en', source: 'user' })

  // And again, forever.
  assert.equal((await boot()).language, 'en')
})

/* ═══════════════ Storage failure ═══════════════ */

test('23. a failed write does not break startup', async () => {
  writesFail = true
  deviceLocale = 'tr-TR'

  const result = await boot()

  // The language is still correct for this launch; only persistence failed.
  assert.deepEqual(result, { language: 'tr', source: 'device' })
})

test('24. a failed write means detection simply runs again next launch', async () => {
  writesFail = true
  deviceLocale = 'tr-TR'
  await boot()

  writesFail = false
  const second = await boot()

  assert.deepEqual(second, { language: 'tr', source: 'device' })
  assert.equal(store.language, 'tr', 'and succeeds once storage recovers')
})

test('25. a completely blank install is treated as fresh — the known limit', async () => {
  // An old anonymous install that never chose a theme, never signed in and
  // never opened the Language screen leaves no trace at all, so it cannot be
  // distinguished from a new one. Documented rather than faked.
  store = {}
  token = null
  deviceLocale = 'tr-TR'

  assert.deepEqual(await boot(), { language: 'tr', source: 'device' })
})

/* ═══════════════ Wiring ═══════════════ */

test('26. the provider passes the real registry, not a copy', () => {
  const source = read('src/features/localization/language-context.tsx')

  assert.ok(
    source.includes('resolveInitialLanguage({ supported: LANGUAGES'),
    'the bootstrap must be given LANGUAGES itself'
  )
  assert.equal(
    /supported:\s*\[/.test(source),
    false,
    'no inline supported-language list'
  )
})

test('27. setLanguage records the choice as the user\'s', () => {
  const source = read('src/features/localization/language-context.tsx')
  const setLanguage = source.slice(source.indexOf('const setLanguage'))

  assert.ok(setLanguage.includes("writeStoredLanguageSource('user')"))
})

test('28. the bootstrap never touches native layout direction', () => {
  const source = read('src/features/localization/language-bootstrap.ts')

  assert.equal(source.includes('forceRTL'), false)
  assert.equal(source.includes('allowRTL'), false)
})
