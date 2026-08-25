// What setTheme actually sends to the account (Phase 10A).
//
// theme-contract.test.mjs proves the MAPPING. This file proves the WIRING: that
// ThemeProvider translates before syncing, and that a mobile-only theme results
// in no HTTP request at all rather than a rejected one.
//
// ── Why a hand-rolled React harness ─────────────────────────────────────
// There is no test renderer in this app and Phase 10A must not install one. So
// the REAL theme-context.tsx is transpiled and executed against a minimal hooks
// implementation. ThemeProvider only uses useState/useRef/useCallback/useMemo/
// useEffect and returns a single element, which is little enough to stand in
// for honestly. Everything under test — the translation, the token guard, the
// storage write — is the real code from the real file.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const transpile = (relative, jsx) =>
  ts.transpileModule(fs.readFileSync(path.join(ROOT, relative), 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(jsx ? { jsx: ts.JsxEmit.React, jsxFactory: '__jsx' } : {}),
    },
  }).outputText

const load = (relative, imports = {}, jsx = false) => {
  const module = { exports: {} }
  const require = (id) => {
    if (id in imports) return imports[id]
    throw new Error(`unexpected import: ${id}`)
  }
  new Function(
    'exports',
    'module',
    'require',
    '__jsx',
    transpile(relative, jsx)
  )(module.exports, module, require, (_type, props) => {
    // The provider element: its `value` prop is the context payload.
    if (props && 'value' in props) captured = props.value
    return null
  })
  return module.exports
}

let captured = null

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

/** Runs the component body once and flushes its effects. */
const render = async (Provider) => {
  cursor = 0
  pendingEffects = []
  Provider({ children: null })
  for (const effect of pendingEffects) effect()
  // Let the AsyncStorage read promise settle.
  await new Promise((r) => setImmediate(r))
  return captured
}

/* ── Scripted externals ──────────────────────────────────────────────── */

let storedTheme = null
let storageWrites = []
let syncCalls = []
let session = { user: null, token: null }

let ThemeProvider

before(() => {
  const constants = load('src/constants/theme.ts')
  const themes = load('src/features/theme/themes.ts', { '@/constants/theme': constants })
  const contract = load('src/features/theme/theme-contract.ts', { './themes': themes })

  const mod = load(
    'src/features/theme/theme-context.tsx',
    {
      react: React,
      '@/features/auth/auth-context': { useAuth: () => session },
      '@/features/preferences/preferences-storage': {
        readStoredTheme: async () => storedTheme,
        writeStoredTheme: async (v) => { storageWrites.push(v) },
      },
      '@/features/account/account-api': {
        updateThemePreference: async (token, theme) => { syncCalls.push({ token, theme }) },
      },
      './theme-contract': contract,
      './themes': themes,
    },
    true
  )

  ThemeProvider = mod.ThemeProvider
})

beforeEach(() => {
  slots = []
  captured = null
  storedTheme = null
  storageWrites = []
  syncCalls = []
  session = { user: null, token: 'jwt-for-tests' }
})

/**
 * Renders repeatedly until the theme stops changing.
 *
 * The context value is built during the component body, so a change made by an
 * effect is only visible on the NEXT render. That is a property of this harness,
 * not of the provider — React would re-render for the same reason.
 */
const settle = async (Provider, passes = 3) => {
  let ctx = null
  for (let i = 0; i < passes; i += 1) ctx = await render(Provider)
  return ctx
}

/** Renders, selects a theme, and reports what left the device. */
const select = async (themeId) => {
  const ctx = await render(ThemeProvider)
  await ctx.setTheme(themeId)
  return { storageWrites, syncCalls }
}

/* ═══════════════ The five themes ═══════════════ */

test('1. Default: stored locally as default, synced as default', async () => {
  const { storageWrites, syncCalls } = await select('default')

  assert.deepEqual(storageWrites, ['default'])
  assert.equal(syncCalls.length, 1)
  assert.equal(syncCalls[0].theme, 'default')
})

test('2. Classic: stored locally as classic, synced as navy — no more 400', async () => {
  const { storageWrites, syncCalls } = await select('classic')

  assert.deepEqual(storageWrites, ['classic'], 'the device keeps its own vocabulary')
  assert.equal(syncCalls.length, 1)
  assert.equal(syncCalls[0].theme, 'navy', 'the server gets the canonical id')
})

test('3. Light: stored locally as light, synced as default', async () => {
  const { storageWrites, syncCalls } = await select('light')

  assert.deepEqual(storageWrites, ['light'])
  assert.equal(syncCalls[0].theme, 'default')
})

test('4. Forest: stored and synced as forest', async () => {
  const { storageWrites, syncCalls } = await select('forest')

  assert.deepEqual(storageWrites, ['forest'])
  assert.equal(syncCalls[0].theme, 'forest')
})

test('5. Dark Luxury: persists locally and sends NOTHING', async () => {
  const { storageWrites, syncCalls } = await select('dark')

  assert.deepEqual(storageWrites, ['dark'], 'the choice still persists on the device')
  assert.equal(syncCalls.length, 0, 'no request at all — not a failed one')
})

test('6. Dark Luxury never writes gold-white to the account', async () => {
  await select('dark')

  assert.equal(
    syncCalls.some((c) => c.theme === 'gold-white'),
    false,
    'the account must not be told the customer picked a light theme'
  )
})

/* ═══════════════ Invariants across every theme ═══════════════ */

test('7. no local-only id ever reaches the network', async () => {
  const CANONICAL = [
    'default', 'forest', 'earth', 'navy',
    'gold-white', 'sand-travertine', 'rosewood-blush', 'blush-ivory',
  ]

  for (const id of ['default', 'classic', 'dark', 'light', 'forest']) {
    slots = []
    syncCalls = []
    storageWrites = []

    await select(id)

    for (const call of syncCalls) {
      assert.ok(CANONICAL.includes(call.theme), `${id} sent ${call.theme}, which is a 400`)
    }
  }
})

test('8. the local choice is always persisted, synced or not', async () => {
  for (const id of ['default', 'classic', 'dark', 'light', 'forest']) {
    slots = []
    syncCalls = []
    storageWrites = []

    await select(id)

    assert.deepEqual(storageWrites, [id], `${id} must survive a restart`)
  }
})

/* ═══════════════ Signed out & offline ═══════════════ */

test('9. signed out: the theme still applies and persists, with no request', async () => {
  session = { user: null, token: null }

  const { storageWrites, syncCalls } = await select('classic')

  assert.deepEqual(storageWrites, ['classic'])
  assert.equal(syncCalls.length, 0)
})

test('10. a failing sync never breaks the local change', async () => {
  // Render asleep, offline, expired token — the theme has already changed on
  // screen and been saved, so the rejection must stay swallowed.
  const mod = load(
    'src/features/theme/theme-context.tsx',
    {
      react: React,
      '@/features/auth/auth-context': { useAuth: () => session },
      '@/features/preferences/preferences-storage': {
        readStoredTheme: async () => null,
        writeStoredTheme: async (v) => { storageWrites.push(v) },
      },
      '@/features/account/account-api': {
        updateThemePreference: async () => { throw new Error('503 Service Unavailable') },
      },
      './theme-contract': load('src/features/theme/theme-contract.ts', {
        './themes': load('src/features/theme/themes.ts', {
          '@/constants/theme': load('src/constants/theme.ts'),
        }),
      }),
      './themes': load('src/features/theme/themes.ts', {
        '@/constants/theme': load('src/constants/theme.ts'),
      }),
    },
    true
  )

  slots = []
  storageWrites = []
  const ctx = await render(mod.ThemeProvider)

  await assert.doesNotReject(() => ctx.setTheme('classic'))
  assert.deepEqual(storageWrites, ['classic'])
})

/* ═══════════════ Account fallback ═══════════════ */

test('11. a canonical account theme is adopted on a device with no choice', async () => {
  storedTheme = null
  session = { user: { themePreference: 'navy' }, token: 'jwt-for-tests' }

  const first = await render(ThemeProvider)
  assert.equal(first.themeId, 'default', 'first paint uses the default')

  const after = await settle(ThemeProvider)
  assert.equal(after.themeId, 'classic', 'navy resolves to Heritage Navy')
})

test('12. an unported account theme leaves the device theme alone', async () => {
  storedTheme = null
  session = { user: { themePreference: 'sand-travertine' }, token: 'jwt-for-tests' }

  const after = await settle(ThemeProvider)

  assert.equal(after.themeId, 'default', 'no stand-in palette is invented')
  assert.deepEqual(storageWrites, [], 'and nothing is written over their real preference')
})

test('13. a device choice always beats the account preference', async () => {
  storedTheme = 'dark'
  session = { user: { themePreference: 'navy' }, token: 'jwt-for-tests' }

  const after = await settle(ThemeProvider)

  assert.equal(after.themeId, 'dark', 'signing in must not undo a choice made on this phone')
})
