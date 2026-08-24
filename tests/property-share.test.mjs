// Property share links (Phase 9A).
//
// A shared link is the one artefact that leaves the phone and lands in somebody
// else's chat, so these tests are mostly about the URL being correct for a
// STRANGER: right host, right path, safe when the data is not.
//
// There is no test runner in this app, so the module under test is transpiled
// with the TypeScript compiler and given a tiny require shim for its one
// runtime import. The REAL src/constants/config.ts is loaded — that is what
// makes the "not API_BASE_URL" test load-bearing rather than decorative.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * A development API address, set BEFORE config.ts is evaluated.
 *
 * config.ts reads EXPO_PUBLIC_API_URL at module scope, so this makes
 * API_BASE_URL a LAN IP for the whole run — exactly the situation in which
 * deriving the share URL from the API URL would leak a developer's laptop
 * address into a WhatsApp message.
 */
const DEV_API_URL = 'http://192.168.100.200:5000/api'
process.env.EXPO_PUBLIC_API_URL = DEV_API_URL

/** Transpiles one .ts file and evaluates it with the given import map. */
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

let buildPropertyUrl
let describePropertyForShare
let buildPropertyShareMessage
let config

before(() => {
  config = load('src/constants/config.ts')
  const shared = load('src/utils/property-share.ts', {
    '@/constants/config': config,
    '@/types/property': {}, // type-only; erased by transpilation
  })
  buildPropertyUrl = shared.buildPropertyUrl
  describePropertyForShare = shared.describePropertyForShare
  buildPropertyShareMessage = shared.buildPropertyShareMessage
})

/* ═══════════════ The URL ═══════════════ */

test('1. a property id becomes the canonical website URL', () => {
  assert.equal(buildPropertyUrl('abc123'), 'https://www.varlikent.com/properties/abc123')
})

test('2. the path matches the website route and the App Link pathPrefix', () => {
  // Phase 9B registers pathPrefix "/properties/" for www.varlikent.com. If this
  // path ever drifted, shared links would stop opening the app.
  const url = new URL(buildPropertyUrl('68f0c1a2b3d4e5f600112233'))

  assert.equal(url.protocol, 'https:', 'a custom scheme is useless to a non-user')
  assert.equal(url.host, 'www.varlikent.com')
  assert.ok(url.pathname.startsWith('/properties/'), url.pathname)
  assert.equal(url.pathname, '/properties/68f0c1a2b3d4e5f600112233')
})

test('3. the URL comes from WEB_BASE_URL, never from API_BASE_URL', () => {
  // The precondition: this build genuinely talks to a LAN address.
  assert.equal(config.API_BASE_URL, DEV_API_URL, 'precondition — API points at a LAN IP')

  const url = buildPropertyUrl('abc123')

  assert.equal(url.includes('192.168.100.200'), false, 'a LAN IP must never be shared')
  assert.equal(url.includes('/api'), false, 'the backend path must never be shared')
  assert.ok(url.startsWith(config.WEB_BASE_URL + '/'))
})

test('4. a missing id yields null rather than a broken URL', () => {
  for (const bad of [undefined, null, '', '   ', 42, {}]) {
    assert.equal(buildPropertyUrl(bad), null, `input: ${JSON.stringify(bad)}`)
  }
})

test('5. an id is encoded, so it cannot escape its path segment', () => {
  const url = buildPropertyUrl('a b/../admin?x=1')

  assert.equal(url.includes(' '), false)
  assert.equal(new URL(url).pathname, '/properties/a%20b%2F..%2Fadmin%3Fx%3D1')
})

/* ═══════════════ The description ═══════════════ */

test('6. the title alone is the description', () => {
  assert.equal(
    describePropertyForShare({ title: 'Modern Apartment', district: 'Kadıköy' }),
    'Modern Apartment'
  )
})

test('7. no English joining word is inserted — the app also ships tr and ar', () => {
  // V1 deliberately does not build "<title> in <district>": that "in" would be
  // English grammar sitting inside a Turkish or Arabic share message. The title
  // is quoted verbatim, in whatever language it was written.
  const description = describePropertyForShare({
    title: 'Şişli Merkezde Daire',
    district: 'Şişli',
  })

  assert.equal(description, 'Şişli Merkezde Daire')
  assert.equal(description.includes(' in '), false, 'no hard-coded English conjunction')
})

test('8. whitespace is collapsed, so a pasted title is not shared ragged', () => {
  assert.equal(
    describePropertyForShare({ title: '  Modern\n\nApartment  ', district: ' Kadıköy ' }),
    'Modern Apartment'
  )
})

test('9. the district is the fallback only when there is no title', () => {
  assert.equal(describePropertyForShare({ title: '', district: 'Kadıköy' }), 'Kadıköy')
  assert.equal(describePropertyForShare({ title: '   ', district: ' Kadıköy ' }), 'Kadıköy')
  assert.equal(describePropertyForShare({ title: 'Villa', district: '' }), 'Villa')
  assert.equal(describePropertyForShare({}), '')
})

/* ═══════════════ The message ═══════════════ */

const message = (property, url = buildPropertyUrl('abc123')) =>
  buildPropertyShareMessage({ property, url, callToAction: 'View on Varlikent:' })

test('10. the message carries the canonical URL', () => {
  const text = message({ title: 'Modern Apartment', district: 'Kadıköy' })

  // Android ignores Share's `url` field entirely, so the link must be in the
  // message body or it silently vanishes from the share.
  assert.ok(text.includes('https://www.varlikent.com/properties/abc123'), text)
  assert.ok(text.includes('Modern Apartment'), text)
  assert.ok(text.includes('View on Varlikent:'), text)
})

test('11. the URL is the last thing in the message, so link preview works', () => {
  const text = message({ title: 'Modern Apartment', district: 'Kadıköy' })
  assert.ok(text.trimEnd().endsWith('https://www.varlikent.com/properties/abc123'), text)
})

test('12. a listing with no title or district still shares a usable link', () => {
  const text = message({})

  assert.ok(text.includes('https://www.varlikent.com/properties/abc123'))
  assert.equal(text.startsWith('\n'), false, 'no empty leading line')
  assert.equal(text.includes('\n\n\n'), false, 'no hole where the description was')
})

test('13. no price is shared — a forwarded message outlives the price it quotes', () => {
  const text = message({ title: 'Modern Apartment', district: 'Kadıköy', price: 4200000 })

  assert.equal(text.includes('4200000'), false, text)
  assert.equal(text.includes('4,200,000'), false, text)
})

test('14. no private or internal data reaches the message', () => {
  const text = message({
    title: 'Modern Apartment',
    district: 'Kadıköy',
    agentPhone: '+90 555 000 0000',
    agentEmail: 'agent@varlikent.com',
    owner: 'owner-id-1234',
  })

  for (const secret of ['+90 555 000 0000', 'agent@varlikent.com', 'owner-id-1234']) {
    assert.equal(text.includes(secret), false, `leaked: ${secret}`)
  }
})

test('15. the property object is never mutated', () => {
  const property = { title: '  Spaced   Title  ', district: 'Kadıköy' }
  const before = JSON.stringify(property)

  message(property)

  assert.equal(JSON.stringify(property), before)
})
