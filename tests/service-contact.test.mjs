// Service → Contact reason mapping (Phase 3).
//
// A service detail page's CTA opens /contact?interestType=<reason>, and that
// reason is matched LITERALLY against the backend's express-validator enum
// (`body('interestType').isIn([...])` in backend/routes/contact.js) before
// being stored on ContactSubmission and used as the LeadRouting lookup key.
//
// So the mapping is an API contract wearing a UI shape, and it has exactly two
// ways to fail:
//
//   1. a service maps to a value the backend rejects — the customer taps a
//      polished button, fills in the form, and gets a 400 they cannot act on;
//   2. a service maps to a TRANSLATED label — the bug the website actually
//      shipped, where a Turkish visitor submitted "Satın Alma" and the form
//      only ever worked in English.
//
// Both are pure data questions, so this file stays a pure data test: no
// rendering, no source-text matching against the service screen's copy. The
// last two tests are the exception, and only because "the mapping is written
// once" and "the CTA pushes" ARE the properties under test.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

/** Transpiles one .ts file and evaluates it with the given import map. */
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

const codes = ['en', 'tr', 'ar', 'de', 'ru', 'ur']

let SERVICES
let getService
let serviceKey
let CONTACT_REASONS
let bundles

before(() => {
  // The REAL contact module, with its one runtime import stubbed. Loading the
  // genuine CONTACT_REASONS rather than restating them here is what makes
  // these tests load-bearing: if someone edits the enum, this file follows.
  const contact = load('src/features/contact/contact-api.ts', {
    '@/services/api-client': { apiRequest: async () => ({}) },
    '@/types/api': {},
  })
  CONTACT_REASONS = contact.CONTACT_REASONS

  // services-data imports ContactReason as a TYPE only, so transpilation
  // erases it and the module has no runtime imports of its own.
  const services = load('src/features/services/services-data.ts')
  SERVICES = services.SERVICES
  getService = services.getService
  serviceKey = services.serviceKey

  bundles = {}
  for (const code of codes) {
    bundles[code] = load(`src/features/localization/translations/${code}.ts`, {
      './en': {},
    })[code]
  }
})

/** Every string value in a bundle, flattened. */
const values = (node, out = []) => {
  for (const value of Object.values(node)) {
    if (typeof value === 'string') out.push(value)
    else if (value && typeof value === 'object') values(value, out)
  }
  return out
}

const at = (bundle, key) => key.split('.').reduce((node, part) => node?.[part], bundle)

/* ═══════════════ The mapping ═══════════════ */

test('1. every service declares exactly one contact reason', () => {
  for (const service of SERVICES) {
    assert.equal(typeof service.contactReason, 'string', `${service.id} has no contactReason`)
    assert.ok(service.contactReason.length > 0, `${service.id} has an empty contactReason`)
  }
})

test('2. every mapped reason is one the backend actually accepts', () => {
  /*
   * CONTACT_REASONS is the same list the validator enum holds. A value outside
   * it is a 400 the customer meets AFTER writing their enquiry, which is the
   * most expensive possible moment to discover it.
   */
  for (const service of SERVICES) {
    assert.ok(
      CONTACT_REASONS.includes(service.contactReason),
      `${service.id} → "${service.contactReason}" is not a valid contact reason`
    )
  }
})

test('3. all four services are covered, and the mapping is exactly this', () => {
  // Spelled out rather than derived, so changing a service's destination is a
  // deliberate edit here and not a silent consequence somewhere else.
  const mapping = Object.fromEntries(SERVICES.map((s) => [s.id, s.contactReason]))

  assert.deepEqual(mapping, {
    architecture: 'Architecture',
    construction: 'Construction',
    renovation: 'Renovation',
    'interior-design': 'Interior Design',
  })
})

test('4. no two services share a reason, and no service id repeats', () => {
  const ids = SERVICES.map((s) => s.id)
  const reasons = SERVICES.map((s) => s.contactReason)

  assert.equal(new Set(ids).size, ids.length, 'a service id appears twice')
  assert.equal(new Set(reasons).size, reasons.length, 'two services route to the same mailbox')
})

test('5. no service silently falls back to General', () => {
  /*
   * 'General' is a real reason and a legitimate choice on the Contact screen
   * itself — but a SERVICE page reaching it would mean someone added a service
   * and left the field at a default. Every service here has its own mailbox.
   */
  for (const service of SERVICES) {
    assert.notEqual(service.contactReason, 'General', `${service.id} chose no destination`)
  }
})

/* ═══════════════ Never a translated label ═══════════════ */

test('6. no mapped value appears as a translated string in any bundle', () => {
  /*
   * The website's bug, asserted directly. Its select submitted the TRANSLATED
   * label, so "Satın Alma" hit an enum containing only "Buying". Here the
   * canonical value and the display label are different objects entirely — the
   * value comes from SERVICES, the chip label from t(reasonKey(...)) — and no
   * mapped value may coincide with any translated string in another language.
   *
   * English is deliberately EXCLUDED: the canonical values ARE English words,
   * so `contact.reasons.architecture === 'Architecture'` is correct rather
   * than a leak. The five non-English bundles are where a translated label
   * being mistaken for a wire value would actually show up.
   */
  const mapped = new Set(SERVICES.map((s) => s.contactReason))

  for (const code of codes.filter((c) => c !== 'en')) {
    for (const value of values(bundles[code])) {
      assert.equal(
        mapped.has(value),
        false,
        `${code} contains "${value}", which is also a contact API value`
      )
    }
  }
})

test('7. each CTA label resolves in every language and is not the API value', () => {
  for (const service of SERVICES) {
    const key = serviceKey(service, 'ctaLabel')

    for (const code of codes) {
      const label = at(bundles[code], key)

      assert.equal(typeof label, 'string', `${code} is missing ${key}`)
      assert.ok(label.trim().length > 0, `${code} has an empty ${key}`)
      // The label is display copy; the reason is the wire value. They travel
      // separately and must never be the same string.
      assert.notEqual(
        label,
        service.contactReason,
        `${code} ${key} is the raw API value rather than a label`
      )
    }
  }
})

test('8. the shared CTA keys exist in every language, with the placeholder intact', () => {
  for (const code of codes) {
    const eyebrow = at(bundles[code], 'services.ctaEyebrow')
    const a11y = at(bundles[code], 'services.ctaAccessibility')

    assert.ok(eyebrow?.trim(), `${code} is missing services.ctaEyebrow`)
    assert.ok(a11y?.trim(), `${code} is missing services.ctaAccessibility`)
    // A dropped placeholder produces an accessibility label that names no
    // service at all — the failure is silent, because the string still reads.
    assert.ok(
      a11y.includes('{service}'),
      `${code} services.ctaAccessibility lost its {service} placeholder`
    )
  }
})

/* ═══════════════ Unknown ids ═══════════════ */

test('9. an unknown service id never produces a contact reason', () => {
  /*
   * The route is dynamic, so /services/anything is reachable — by a typo, a
   * stale deep link, or a URL somebody shared. The CTA must not exist for it,
   * and cannot: the screen returns its not-found branch before the ScrollView,
   * and getService is the only route to a contactReason.
   */
  for (const id of [
    'sell-your-property',
    'Architecture',
    'interior design',
    'interior_design',
    '',
    undefined,
    '../contact',
  ]) {
    assert.equal(getService(id), undefined, `${String(id)} resolved to a service`)
  }
})

/* ═══════════════ One definition, and real history ═══════════════ */

test('10. the mapping is declared in exactly one file', () => {
  /*
   * A second copy — a lookup table in contact-api.ts, a switch in the service
   * screen — is how two spellings drift and one starts sending a reason the
   * backend rejects. The field on ServiceStructure is the only place a service
   * and its reason are written down together.
   */
  assert.equal(
    (read('src/features/services/services-data.ts').match(/contactReason:/g) ?? []).length,
    // the type declaration, plus one per service
    1 + SERVICES.length
  )

  // The screen READS the field; it never re-derives it from the id.
  const screen = read('src/app/services/[service].tsx')
  assert.ok(screen.includes('service.contactReason'), 'the screen does not use the mapping')
  assert.equal(
    /service(Param)?\s*===\s*'/.test(screen),
    false,
    'the screen compares service ids by hand instead of reading the mapping'
  )

  // And nothing translates it on the way out.
  assert.equal(
    /interestType:\s*t\(/.test(screen),
    false,
    'a translated string is being sent as the API value'
  )
})

test('11. the CTA pushes, so Back returns to the service page', () => {
  const screen = read('src/app/services/[service].tsx')

  assert.ok(
    /router\.push\(\{\s*pathname: '\/contact'/.test(screen),
    'the CTA does not push /contact'
  )
  assert.equal(
    /router\.replace\(\s*\{?\s*(pathname: )?'\/contact'/.test(screen),
    false,
    'replacing would drop the service page from history'
  )
})
