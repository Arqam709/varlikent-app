// Company contact links (Phase 2).
//
// Every value these builders consume is typed by an administrator into
// /api/settings and can be changed without an app release. That is the whole
// point of reading them from the backend — and it is also why they cannot be
// trusted to arrive in any particular shape. These tests pin what happens to a
// number with spaces, a cleared field, and an admin who pasted a whole URL
// where a number was expected.
//
// The module under test is pure TypeScript with no imports, so it is
// transpiled and evaluated directly — the same approach property-share.test.mjs
// uses, minus the require shim it does not need.

import test from 'node:test'
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
  new Function('module', 'exports', outputText)(module, module.exports)
  return module.exports
}

const { buildTelUrl, buildMailtoUrl, buildWhatsAppUrls, buildMapsUrl } =
  load('src/utils/contact-links.ts')

/* ── The values actually stored today ─────────────────────────────────── */
// Read from the live GET /api/settings while writing this phase. If the
// builders stop handling these exact strings, the Contact screen breaks for
// real customers, not hypothetical ones.
const LIVE = {
  phone: '+90 533 166 49 10',
  whatsapp: '+905331664910',
  email: 'info@varlikent.com',
  address: 'Violet Sitesi, Gürpınar, Tevfik Fikret Cd. C Blok, No 20C, 34528 Beylikdüzü/İstanbul',
  mapsUrl: 'https://maps.app.goo.gl/CbnDRky4DTZfEwh77',
}

/* ══════════════════════════ tel: ══════════════════════════ */

test('tel: strips the spaces the admin form stores and keeps the country code', () => {
  assert.equal(buildTelUrl(LIVE.phone), 'tel:+905331664910')
})

test('tel: tolerates every separator a human might type', () => {
  for (const written of [
    '+90 533 166 49 10',
    '+90-533-166-49-10',
    '+90 (533) 166 49 10',
    '  +905331664910  ',
  ]) {
    assert.equal(buildTelUrl(written), 'tel:+905331664910', written)
  }
})

test('tel: keeps a local number local rather than inventing a country code', () => {
  // Guessing +90 would be a fabrication; a local number still dials locally.
  assert.equal(buildTelUrl('0533 166 49 10'), 'tel:05331664910')
})

test('tel: yields null for anything that cannot be dialled', () => {
  for (const empty of ['', '   ', null, undefined, '+', '--']) {
    assert.equal(buildTelUrl(empty), null, JSON.stringify(empty))
  }
})

/* ══════════════════════════ mailto: ══════════════════════════ */

test('mailto: uses the address verbatim', () => {
  assert.equal(buildMailtoUrl(LIVE.email), 'mailto:info@varlikent.com')
})

test('mailto: carries no subject or body', () => {
  // A pre-filled subject would put an English string into the outgoing mail of
  // a customer reading the app in Turkish or Arabic.
  const url = buildMailtoUrl(LIVE.email)
  assert.equal(url.includes('?'), false, 'no query parameters')
})

test('mailto: yields null rather than a dead button', () => {
  for (const bad of ['', '   ', null, undefined, 'not-an-email', 'a@b', 'two @ signs@x.com']) {
    assert.equal(buildMailtoUrl(bad), null, JSON.stringify(bad))
  }
})

/* ══════════════════════════ wa.me ══════════════════════════ */

test('WhatsApp offers the native app first, then the web link', () => {
  // The whole point of the pair: tapping "WhatsApp" must open WhatsApp, not a
  // browser that then hands off to WhatsApp.
  assert.deepEqual(buildWhatsAppUrls(LIVE.whatsapp), [
    'whatsapp://send?phone=905331664910',
    'https://wa.me/905331664910',
  ])
})

test('WhatsApp strips the stored leading + from BOTH forms', () => {
  // Neither wa.me nor the whatsapp: scheme accepts a '+'. The website
  // interpolates the stored value raw and emits wa.me/+9053… — tolerated, but
  // not the documented format, and not something to copy.
  const [app, web] = buildWhatsAppUrls(LIVE.whatsapp)

  assert.equal(app.includes('+'), false, 'the deep link must be digits only')
  assert.equal(web.includes('+'), false, 'the web link must be digits only')
})

test('WhatsApp accepts a number written with spaces', () => {
  assert.deepEqual(buildWhatsAppUrls('+90 533 166 49 10'), [
    'whatsapp://send?phone=905331664910',
    'https://wa.me/905331664910',
  ])
})

test('WhatsApp honours a pasted native link as the only candidate', () => {
  // A native scheme is already the most direct form; there is nothing to
  // prefer ahead of it.
  assert.deepEqual(
    buildWhatsAppUrls('whatsapp://send?phone=905331664910'),
    ['whatsapp://send?phone=905331664910']
  )
})

test('WhatsApp still prefers the app when an admin pasted a web link', () => {
  // Honour what was typed, but do not silently downgrade every customer to the
  // browser route just because the field holds a URL.
  for (const link of [
    'https://wa.me/905331664910',
    'https://api.whatsapp.com/send?phone=905331664910',
    'https://wa.me/+905331664910',
  ]) {
    assert.deepEqual(
      buildWhatsAppUrls(link),
      ['whatsapp://send?phone=905331664910', link],
      link
    )
  }
})

test('WhatsApp keeps an unrecognised link rather than discarding it', () => {
  const link = 'https://varlikent.com/whatsapp'
  assert.deepEqual(buildWhatsAppUrls(link), [link])
})

test('WhatsApp yields no candidates for a cleared or placeholder value', () => {
  for (const bad of ['', '   ', null, undefined, '+', '0', '12345']) {
    assert.deepEqual(buildWhatsAppUrls(bad), [], JSON.stringify(bad))
  }
})

/* ══════════════════════════ maps ══════════════════════════ */

test('maps prefers the configured share link over a text search', () => {
  // The link resolves to the exact pin an administrator chose; a text search
  // can land on a similarly named street in another district.
  assert.equal(buildMapsUrl(LIVE.mapsUrl, LIVE.address), LIVE.mapsUrl)
})

test('maps falls back to the address when no link is configured', () => {
  const url = buildMapsUrl('', LIVE.address)

  assert.ok(url.startsWith('https://www.google.com/maps/search/?api=1&query='))
  // Turkish characters must survive as UTF-8 or the search misses.
  assert.ok(url.includes(encodeURIComponent('Beylikdüzü')), 'address is percent-encoded')
  assert.equal(url.includes(' '), false, 'no raw spaces in a URL')
})

test('maps ignores a value that is not a web link', () => {
  // A geo: URI has no handler on many devices, so it would render a button
  // that does nothing; falling back to the searchable address is better.
  const url = buildMapsUrl('geo:41.0082,28.9784', LIVE.address)
  assert.ok(url.startsWith('https://'), 'must not emit a scheme the OS may not handle')
})

test('maps yields null when there is neither a link nor an address', () => {
  for (const pair of [['', ''], [null, null], [undefined, '   ']]) {
    assert.equal(buildMapsUrl(pair[0], pair[1]), null, JSON.stringify(pair))
  }
})

/* ══════════════════════════ shared contract ══════════════════════════ */

test('every builder yields nothing rather than a string containing "undefined"', () => {
  // The failure this whole module exists to prevent: `tel:undefined` opens the
  // dialer with nothing in it, which is worse than no button at all.
  for (const build of [buildTelUrl, buildMailtoUrl]) {
    for (const empty of [undefined, null, '']) {
      assert.equal(build(empty), null, `${build.name}(${JSON.stringify(empty)})`)
    }
  }

  for (const empty of [undefined, null, '']) {
    assert.deepEqual(buildWhatsAppUrls(empty), [], JSON.stringify(empty))
  }

  assert.equal(buildMapsUrl(undefined, undefined), null)
})

test('no candidate anywhere is ever a bare scheme with nothing after it', () => {
  const all = [
    buildTelUrl(LIVE.phone),
    buildMailtoUrl(LIVE.email),
    ...buildWhatsAppUrls(LIVE.whatsapp),
    buildMapsUrl(LIVE.mapsUrl, LIVE.address),
  ]

  for (const url of all) {
    assert.ok(url, 'every live value must produce a URL')
    assert.equal(url.includes('undefined'), false, url)
    assert.equal(/^[a-z]+:(\/\/)?$/.test(url), false, `${url} carries no payload`)
  }
})
