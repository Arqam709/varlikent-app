// Opening an external app, with a fallback.
//
// ── The bug this file exists to prevent coming back ─────────────────────
// The first version of the Contact actions asked `Linking.canOpenURL(url)` and
// treated `false` as "not available". That is wrong on both platforms:
//
//   iOS      canOpenURL resolves false for `whatsapp://` unless the scheme is
//            listed in LSApplicationQueriesSchemes. This app declares no
//            infoPlist, so the answer was always false.
//   Android  since API 30, package visibility filters the queryIntentActivities
//            call behind canOpenURL, so an installed handler is invisible —
//            `mailto:` and `tel:` included.
//
// Both produce the same symptom: a button that reports "unavailable" on a phone
// where the app is installed and working. openURL has neither limitation, so
// the fix is to ATTEMPT rather than ask.
//
// `openFirstAvailable` takes its opener as a parameter precisely so that
// ordering and failure handling can be tested here, off-device, without
// stubbing react-native.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Loads a module with react-native's `Linking` replaced by `linking`.
 *
 * The stub is injectable because the DEFAULT opener — the one production
 * actually uses — reaches through this import, and that default is precisely
 * what the tests below have to exercise.
 */
const load = (relative, linking) => {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => {
    if (id === 'react-native') {
      return {
        Linking: linking ?? {
          openURL: async () => { throw new Error('Linking stub not configured') },
        },
      }
    }
    throw new Error(`unexpected import: ${id}`)
  }
  // __DEV__ is a React Native global. False here so the diagnostic warn in the
  // catch block does not spray the test output.
  new Function('module', 'exports', 'require', '__DEV__', outputText)(
    module,
    module.exports,
    require,
    false
  )
  return module.exports
}

const { openFirstAvailable } = load('src/utils/open-external-url.ts')

/**
 * A stand-in for RN 0.81.5's real `Linking`, faithful in the one way that
 * matters: `openURL` is a PROTOTYPE METHOD that dereferences `this`.
 *
 * The real implementation opens with `this._validateURL(url)`
 * (node_modules/react-native/Libraries/Linking/Linking.js), and `Linking` is
 * `new LinkingImpl()` — a class instance, not a bound object literal. So a
 * detached reference throws a TypeError before any native call happens, and a
 * stub written as a plain object literal would NOT reproduce that.
 */
const makeLinkingStub = () => {
  class LinkingImpl {
    constructor() {
      this.opened = []
      this.installed = []
    }

    _validateURL(url) {
      if (typeof url !== 'string' || !url) throw new Error('Invalid URL')
    }

    async openURL(url) {
      // Mirrors the real method: the very first thing it does needs `this`.
      this._validateURL(url)
      if (!this.installed.includes(url)) throw new Error('ActivityNotFoundException')
      this.opened.push(url)
    }
  }

  return new LinkingImpl()
}

/**
 * Whether a source file CALLS canOpenURL, as opposed to merely naming it.
 *
 * Every file touched by this fix carries a comment explaining why canOpenURL is
 * the wrong tool here — one of them even quotes `canOpenURL('whatsapp://…')` as
 * the example that fails. So the guard strips comments first and only then
 * looks for a call. Searching the raw text would make each explanation read as
 * a violation of the rule it is explaining.
 *
 * Only whole-line and block comments are removed, never a trailing `//` on a
 * code line — that would also swallow any `https://` inside a string literal
 * and quietly weaken the check into a false negative.
 */
const callsCanOpenUrl = (source) => {
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')

  return /canOpenURL\s*\(/.test(code)
}

/** An opener that succeeds only for the URLs listed, and records every attempt. */
const opener = (installed) => {
  const attempts = []
  const open = async (url) => {
    attempts.push(url)
    if (!installed.includes(url)) throw new Error('ActivityNotFoundException')
    return true
  }
  return { open, attempts }
}

const WHATSAPP_APP = 'whatsapp://send?phone=905331664910'
const WHATSAPP_WEB = 'https://wa.me/905331664910'
const MAILTO = 'mailto:info@varlikent.com'

/* ══════════ The WhatsApp chain — a device WITH WhatsApp ══════════ */

test('opens the native app and never reaches the web fallback', async () => {
  const { open, attempts } = opener([WHATSAPP_APP, WHATSAPP_WEB])

  const opened = await openFirstAvailable([WHATSAPP_APP, WHATSAPP_WEB], open)

  assert.equal(opened, WHATSAPP_APP, 'the deep link must win')
  assert.deepEqual(attempts, [WHATSAPP_APP], 'the browser must not also be opened')
})

/* ══════════ A device WITHOUT WhatsApp ══════════ */

test('falls back to wa.me when WhatsApp is not installed', async () => {
  // The Android emulator case: no WhatsApp, but a browser is present.
  const { open, attempts } = opener([WHATSAPP_WEB])

  const opened = await openFirstAvailable([WHATSAPP_APP, WHATSAPP_WEB], open)

  assert.equal(opened, WHATSAPP_WEB)
  assert.deepEqual(attempts, [WHATSAPP_APP, WHATSAPP_WEB], 'the app is tried first, then the web')
})

/* ══════════ A device with neither ══════════ */

test('reports failure only after every candidate is refused', async () => {
  // A bare emulator: no WhatsApp AND no browser. This is a legitimate device
  // state, not a bug — the screen shows its localized message and keeps the
  // number visible as text.
  const { open, attempts } = opener([])

  const opened = await openFirstAvailable([WHATSAPP_APP, WHATSAPP_WEB], open)

  assert.equal(opened, null, 'null is the caller’s signal to show its own message')
  assert.deepEqual(attempts, [WHATSAPP_APP, WHATSAPP_WEB], 'both were genuinely attempted')
})

/* ══════════ Single-candidate actions ══════════ */

test('a single URL still opens', async () => {
  const { open, attempts } = opener([MAILTO])

  assert.equal(await openFirstAvailable([MAILTO], open), MAILTO)
  assert.deepEqual(attempts, [MAILTO])
})

test('a single URL with no handler reports failure rather than throwing', async () => {
  // No mail client configured. The old code path threw inside the component;
  // this resolves so the caller can show the address instead.
  const { open } = opener([])

  const opened = await openFirstAvailable([MAILTO], open)
  assert.equal(opened, null)
})

test('an empty candidate list is a refusal, not a crash', async () => {
  const { open, attempts } = opener([])

  assert.equal(await openFirstAvailable([], open), null)
  assert.deepEqual(attempts, [], 'nothing to attempt')
})

test('blank entries are skipped rather than opened', async () => {
  const { open, attempts } = opener([WHATSAPP_WEB])

  const opened = await openFirstAvailable(['', WHATSAPP_WEB], open)

  assert.equal(opened, WHATSAPP_WEB)
  assert.deepEqual(attempts, [WHATSAPP_WEB], 'an empty string is never handed to the OS')
})

/* ══════════ The contract that keeps the fix in place ══════════ */

test('nothing is asked before opening', async () => {
  // The regression guard. If canOpenURL ever comes back, the WhatsApp and
  // Email buttons start lying about being unavailable again.
  const source = fs.readFileSync(path.join(ROOT, 'src/utils/open-external-url.ts'), 'utf8')

  assert.ok(source.includes('canOpenURL'), 'the file must keep explaining why it is avoided')
  assert.equal(callsCanOpenUrl(source), false, 'canOpenURL must never be called')
})

test('no Contact surface calls canOpenURL any more', async () => {
  for (const file of [
    'src/components/contact/contact-action.tsx',
    'src/app/contact.tsx',
  ]) {
    const source = fs.readFileSync(path.join(ROOT, file), 'utf8')
    assert.equal(callsCanOpenUrl(source), false, `${file} still asks before opening`)
  }
})

test('the first attempted candidate is the native scheme, end to end', async () => {
  // Ties the builder to the opener: the pair that contact.tsx actually passes
  // must put the app-opening URL first.
  const links = load('src/utils/contact-links.ts')
  const candidates = links.buildWhatsAppUrls('+905331664910')
  const { open, attempts } = opener([])

  await openFirstAvailable(candidates, open)

  assert.ok(attempts[0].startsWith('whatsapp://'), `tried ${attempts[0]} first`)
  assert.ok(attempts[1].startsWith('https://wa.me/'), `fell back to ${attempts[1]}`)
})

/* ══════════ The PRODUCTION path — no injected opener ══════════ */
//
// Everything above passes its own `open`, which is exactly why the suite could
// report green while every button on a real phone failed. These tests call
// openFirstAvailable with ONE argument, so the module's own default opener runs
// — the code path a device actually takes.

test('the default opener calls Linking.openURL as a METHOD, not a detached function', async () => {
  // The regression. `open = Linking.openURL` loses the receiver, so the real
  // method's first line — this._validateURL(url) — throws
  //   TypeError: Cannot read properties of undefined (reading '_validateURL')
  // synchronously, for every candidate, on every platform. The catch swallowed
  // it and the screen reported "could not be opened" with all apps installed.
  const linking = makeLinkingStub()
  linking.installed = [WHATSAPP_APP]

  const { openFirstAvailable: openWithStub } = load('src/utils/open-external-url.ts', linking)

  const opened = await openWithStub([WHATSAPP_APP])

  assert.equal(opened, WHATSAPP_APP, 'the default path must actually open the URL')
  assert.deepEqual(linking.opened, [WHATSAPP_APP], 'openURL ran with its receiver intact')
})

test('the default opener falls back to the web link without an injected opener', async () => {
  // The real WhatsApp chain, driven entirely by production code.
  const linking = makeLinkingStub()
  linking.installed = [WHATSAPP_WEB] // WhatsApp absent, browser present

  const { openFirstAvailable: openWithStub } = load('src/utils/open-external-url.ts', linking)
  const links = load('src/utils/contact-links.ts')

  const opened = await openWithStub(links.buildWhatsAppUrls('+905331664910'))

  assert.equal(opened, WHATSAPP_WEB)
  assert.deepEqual(linking.opened, [WHATSAPP_WEB])
})

test('the default opener reports failure only when the handler is genuinely missing', async () => {
  // Distinguishes "no app installed" from "our JavaScript is broken". Both used
  // to look identical from the outside; only this one may return null.
  const linking = makeLinkingStub()
  linking.installed = []

  const { openFirstAvailable: openWithStub } = load('src/utils/open-external-url.ts', linking)

  assert.equal(await openWithStub([MAILTO]), null)
  assert.deepEqual(linking.opened, [], 'nothing opened, and nothing crashed')
})

test('mailto and maps take the same default path as WhatsApp', async () => {
  // One helper powers all three actions, so one receiver bug broke all three.
  const MAPS = 'https://maps.app.goo.gl/CbnDRky4DTZfEwh77'
  const linking = makeLinkingStub()
  linking.installed = [MAILTO, MAPS]

  const { openFirstAvailable: openWithStub } = load('src/utils/open-external-url.ts', linking)

  assert.equal(await openWithStub([MAILTO]), MAILTO)
  assert.equal(await openWithStub([MAPS]), MAPS)
  assert.deepEqual(linking.opened, [MAILTO, MAPS])
})

test('the stub is strict enough to catch a detached method', async () => {
  // Proves the three tests above can actually FAIL. A stub written as a plain
  // object literal would pass them even with the bug present, because an object
  // literal's method does not need its receiver.
  const linking = makeLinkingStub()
  linking.installed = [MAILTO]

  const detached = linking.openURL
  await assert.rejects(
    async () => detached(MAILTO),
    (error) => error instanceof TypeError,
    'a detached reference must throw exactly as the real Linking does'
  )
})

test('Linking.openURL is never used as a bare default', async () => {
  // The spelling guard, alongside the behavioural ones above. Comments are
  // stripped first because this module documents the bug at length.
  const source = fs.readFileSync(path.join(ROOT, 'src/utils/open-external-url.ts'), 'utf8')
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n')

  assert.equal(
    /=\s*Linking\.openURL\s*[,;)\n]/.test(code),
    false,
    'a bare `= Linking.openURL` detaches the method — wrap it in an arrow'
  )
  assert.ok(
    /Linking\.openURL\s*\(/.test(code),
    'the default must still CALL Linking.openURL'
  )
})
