// The mobile ↔ shared theme vocabulary (Phase 10A).
//
// This contract exists because `PUT /users/me/theme` validates against eight
// canonical website ids and returns 400 for anything else — so mobile's
// `classic`, `dark` and `light` were being rejected on every sync, invisibly,
// because the failure is swallowed by design.
//
// The tests below are about HONESTY as much as correctness: the dangerous bug
// is not a 400, it is a sync that succeeds while storing a theme the customer
// is not looking at. Several tests exist purely to pin that down.
//
// Same harness as property-share.test.mjs: the real TypeScript is transpiled
// and given a require shim, so no test framework is installed.

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
    throw new Error(`unexpected import: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

/**
 * The backend's `VALID` array, restated.
 *
 * Deliberately hard-coded rather than read from the backend repo: this test must
 * pass in a checkout of the mobile app alone. It is the mobile-side statement of
 * the shared contract, and if the backend ever changes its list this assertion
 * is exactly what should fail.
 */
const BACKEND_VALID = [
  'default',
  'forest',
  'earth',
  'navy',
  'gold-white',
  'sand-travertine',
  'rosewood-blush',
  'blush-ivory',
]

let toSharedThemeId
let fromSharedThemeId
let SHARED_THEME_IDS
let THEME_IDS
let THEME_META
let toThemeId

before(() => {
  const constants = load('src/constants/theme.ts')
  const themes = load('src/features/theme/themes.ts', { '@/constants/theme': constants })
  const contract = load('src/features/theme/theme-contract.ts', { './themes': themes })

  toSharedThemeId = contract.toSharedThemeId
  fromSharedThemeId = contract.fromSharedThemeId
  SHARED_THEME_IDS = contract.SHARED_THEME_IDS
  THEME_IDS = themes.THEME_IDS
  THEME_META = themes.THEME_META
  toThemeId = themes.toThemeId
})

/* ═══════════════ local → shared ═══════════════ */

test('1. default syncs as the shared default', () => {
  assert.equal(toSharedThemeId('default'), 'default')
})

test('2. classic syncs as navy', () => {
  // Heritage Navy is the website's Bosphorus Midnight, and the website's own
  // LEGACY_THEME_MAP already declares classic → navy.
  assert.equal(toSharedThemeId('classic'), 'navy')
})

test('3. light syncs as the shared default', () => {
  assert.equal(toSharedThemeId('light'), 'default')
})

test('4. forest syncs as forest', () => {
  assert.equal(toSharedThemeId('forest'), 'forest')
})

test('5. dark has NO shared id — it is mobile-only', () => {
  assert.equal(toSharedThemeId('dark'), null)
})

test('6. dark is never sent as gold-white, whatever the website maps it to', () => {
  // The website's LEGACY_THEME_MAP says dark → gold-white. Honouring that would
  // mean choosing a dark theme on a phone silently turns the website LIGHT.
  // This test is the whole reason the null case exists.
  assert.notEqual(toSharedThemeId('dark'), 'gold-white')
  assert.equal(toSharedThemeId('dark'), null)
})

/* ═══════════════ shared → local ═══════════════ */

test('7. shared default becomes the mobile default', () => {
  assert.equal(fromSharedThemeId('default'), 'default')
})

test('8. shared navy becomes mobile classic', () => {
  assert.equal(fromSharedThemeId('navy'), 'classic')
})

test('9. shared forest becomes mobile forest', () => {
  assert.equal(fromSharedThemeId('forest'), 'forest')
})

test('10. the six unported canonical themes are safely unsupported', () => {
  for (const id of ['earth', 'gold-white', 'sand-travertine', 'rosewood-blush', 'blush-ivory']) {
    assert.equal(fromSharedThemeId(id), null, `${id} must not resolve to a stand-in palette`)
  }
})

test('11. shared gold-white does NOT become mobile Dark Luxury', () => {
  // gold-white is Ivory & Antique Brass — a LIGHT theme. Mapping it onto the
  // only dark palette mobile has would invert the customer's screen.
  const resolved = fromSharedThemeId('gold-white')

  assert.notEqual(resolved, 'dark')
  assert.equal(resolved, null)
})

test('12. an unsupported theme resolves to null, never to a default that would overwrite storage', () => {
  // null is the signal for "leave the current theme alone". Returning 'default'
  // here would silently replace a preference the customer really made.
  assert.equal(fromSharedThemeId('earth'), null)
  assert.notEqual(fromSharedThemeId('earth'), 'default')
})

test('13. junk, absent and non-string values never crash', () => {
  for (const bad of [undefined, null, '', '   ', 42, {}, [], 'nonsense', 'DEFAULT']) {
    assert.equal(fromSharedThemeId(bad), null, `input: ${JSON.stringify(bad)}`)
  }
})

/* ═══════════════ Legacy stored values ═══════════════ */

test('14. every existing local id still loads through toThemeId', () => {
  // Phase 10A must not invalidate anything already in AsyncStorage.
  for (const id of ['default', 'classic', 'dark', 'light', 'forest']) {
    assert.equal(toThemeId(id), id, `${id} must remain a loadable stored value`)
  }
})

test('15. a legacy account value is honoured rather than discarded', () => {
  // An account written by an older build may still hold a mobile id.
  assert.equal(fromSharedThemeId('classic'), 'classic')
  assert.equal(fromSharedThemeId('light'), 'light')
})

test('16. no migration turns a stored dark theme into a light one', () => {
  // The single most damaging possible regression: waking up in a light theme.
  assert.equal(toThemeId('dark'), 'dark')
  assert.equal(fromSharedThemeId('dark'), 'dark')
  assert.equal(THEME_META[fromSharedThemeId('dark')].isDark, true)
})

/* ═══════════════ Whole-contract invariants ═══════════════ */

test('17. every visible mobile theme has an explicit contract entry', () => {
  for (const id of THEME_IDS) {
    const shared = toSharedThemeId(id)
    assert.ok(
      shared === null || typeof shared === 'string',
      `${id} has no decision recorded — it must map to a shared id or explicitly to null`
    )
    assert.notEqual(shared, undefined, `${id} is missing from the mapping table`)
  }
})

test('18. the adapter can never emit an id the backend would reject', () => {
  for (const id of THEME_IDS) {
    const shared = toSharedThemeId(id)
    if (shared === null) continue
    assert.ok(BACKEND_VALID.includes(shared), `${id} → ${shared} would be a 400`)
  }
})

test('19. the shared list matches the backend VALID array exactly', () => {
  assert.deepEqual(SHARED_THEME_IDS, BACKEND_VALID)
})

test('20. every shared id resolves to a real mobile theme or to null', () => {
  for (const id of SHARED_THEME_IDS) {
    const local = fromSharedThemeId(id)
    if (local === null) continue
    assert.ok(THEME_IDS.includes(local), `${id} → ${local} is not a real mobile theme`)
  }
})

test('21. the round trip never changes what the customer is looking at', () => {
  // For any theme that DOES sync, translating out and back must land on a
  // palette of the same lightness — otherwise a login would flip the screen.
  for (const id of THEME_IDS) {
    const shared = toSharedThemeId(id)
    if (shared === null) continue

    const back = fromSharedThemeId(shared)
    if (back === null) continue

    assert.equal(
      THEME_META[back].isDark,
      THEME_META[id].isDark,
      `${id} → ${shared} → ${back} changes light/dark`
    )
  }
})
