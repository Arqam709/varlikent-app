// Service → Contact interest mapping.
//
// A service detail page's CTA opens /contact?interestType=<id>, and the Contact
// screen resolves that id against the backend's shared contact contract, then
// submits the resolved entry's LEGACY value — the literal string
// POST /api/contact validates and LeadRouting keys off.
//
// ── What changed in Phase 1 ─────────────────────────────────────────────
// Services used to carry the legacy value itself ('Interior Design'), typed
// against mobile's own hardcoded CONTACT_REASONS. That list never included
// Troubleshoot and was never compared with the website's. Services now carry a
// STABLE ID ('interior_design') from the shared contract, and this file pins
// that the resolved value is unchanged for all four services.
//
// Pure data tests, plus two source checks where "the mapping is written once"
// and "the CTA pushes" ARE the properties under test.

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
let interests
let bundles

before(() => {
  // The REAL contract module, with its one runtime import stubbed. Loading the
  // genuine fallback rather than restating it here is what makes these tests
  // follow the contract when it changes.
  interests = load('src/features/contact/contact-interests.ts', {
    '@/services/api-client': { apiRequest: async () => ({}) },
  })

  // services-data imports the interest id as a TYPE only, so transpilation
  // erases it and the module has no runtime imports of its own.
  const services = load('src/features/services/services-data.ts')
  SERVICES = services.SERVICES
  getService = services.getService
  serviceKey = services.serviceKey

  bundles = {}
  for (const code of codes) {
    bundles[code] = load(`src/features/localization/translations/${code}.ts`, { './en': {} })[code]
  }
})

const at = (bundle, key) => key.split('.').reduce((node, part) => node?.[part], bundle)

/* ═══════════════ The mapping ═══════════════ */

test('1. every service declares exactly one contact interest id', () => {
  for (const service of SERVICES) {
    assert.equal(typeof service.contactInterestId, 'string', `${service.id} has no contactInterestId`)
    assert.ok(service.contactInterestId.length > 0, `${service.id} has an empty contactInterestId`)
  }
})

test('2. every mapped id exists in the shared contract', () => {
  const ids = interests.FALLBACK_CONTACT_INTERESTS.map((i) => i.id)
  for (const service of SERVICES) {
    assert.ok(ids.includes(service.contactInterestId),
      `${service.id} → '${service.contactInterestId}' is not a contact interest`)
  }
})

test('3. all four services are covered, and the mapping is exactly this', () => {
  // Spelled out rather than derived, so changing a service's destination is a
  // deliberate edit here and not a silent consequence somewhere else.
  const mapping = Object.fromEntries(SERVICES.map((s) => [s.id, s.contactInterestId]))

  assert.deepEqual(mapping, {
    architecture: 'architecture',
    construction: 'construction',
    renovation: 'renovation',
    'interior-design': 'interior_design',
  })
})

test('4. each service still submits the same legacy value it always did', () => {
  // The contract check that matters to the backend and to lead routing: moving
  // from values to ids must not change a single submitted string.
  const submitted = Object.fromEntries(
    SERVICES.map((s) => [
      s.id,
      interests.resolveContactInterest(interests.FALLBACK_CONTACT_INTERESTS, s.contactInterestId).value,
    ])
  )

  assert.deepEqual(submitted, {
    architecture: 'Architecture',
    construction: 'Construction',
    renovation: 'Renovation',
    'interior-design': 'Interior Design',
  })
})

test('5. no two services share an interest, and no service id repeats', () => {
  const ids = SERVICES.map((s) => s.id)
  const targets = SERVICES.map((s) => s.contactInterestId)

  assert.equal(new Set(ids).size, ids.length, 'a service id appears twice')
  assert.equal(new Set(targets).size, targets.length, 'two services route to the same mailbox')
})

test('6. no service silently falls back to General', () => {
  for (const service of SERVICES) {
    assert.notEqual(service.contactInterestId, 'general', `${service.id} chose no destination`)
  }
})

test('7. mapped ids are stable machine ids, never display strings', () => {
  const values = interests.FALLBACK_CONTACT_INTERESTS.map((i) => i.value)
  for (const service of SERVICES) {
    assert.match(service.contactInterestId, /^[a-z][a-z0-9_]*$/, `${service.id} maps to a display-shaped string`)
    assert.equal(values.includes(service.contactInterestId), false,
      `${service.id} maps to a legacy value instead of an id`)
  }
})

/* ═══════════════ Preselection round-trip ═══════════════ */

test('8. the id a service pushes resolves to that same entry on the Contact screen', () => {
  for (const service of SERVICES) {
    const resolved = interests.resolveContactInterest(interests.FALLBACK_CONTACT_INTERESTS, service.contactInterestId)
    assert.equal(resolved.id, service.contactInterestId, `${service.id} lands on the wrong chip`)
  }
})

test('9. older links carrying the legacy value still preselect the right entry', () => {
  // `/contact?interestType=Interior%20Design` is what services sent before
  // Phase 1, and what shared URLs may still carry.
  assert.equal(interests.resolveContactInterest(interests.FALLBACK_CONTACT_INTERESTS, 'Interior Design').id, 'interior_design')
  assert.equal(interests.resolveContactInterest(interests.FALLBACK_CONTACT_INTERESTS, 'Construction').id, 'construction')
})

test('9b. a service whose interest an admin disabled lands on General, never on a hidden option', () => {
  // The server omits disabled interests. The service link still carries its
  // known id; the Contact screen resolves it against the list it shows.
  const offered = interests.FALLBACK_CONTACT_INTERESTS.filter((interest) => interest.id !== 'construction')
  const resolved = interests.resolveContactInterest(offered, 'construction')

  assert.equal(resolved.id, 'general')
  assert.equal(resolved.value, 'General')
})

test('10. the Contact screen resolves the route param against the list it is showing', () => {
  const screen = read('src/app/contact.tsx')
  assert.ok(screen.includes('requestedContactInterestKey(interestTypeParam)'),
    'the Contact screen no longer starts from the route param')
  assert.ok(screen.includes('resolveContactInterest(interests, reasonKey)'),
    'the selection must be resolved against the current list, not the bundled one')
  assert.ok(screen.includes('interestType: selectedInterest.value'),
    'the Contact screen must submit the resolved entry\'s legacy value')
})

/* ═══════════════ CTA copy ═══════════════ */

test('11. each CTA label resolves in every language and is not the API value', () => {
  // Since Phase 3 the button text is service PAGE content (`ctaBtn`, admin-
  // managed on the website) with the app's bundled copy as its fallback.
  const fallback = load('src/features/services/service-content-fallback.ts').SERVICE_CONTENT_FALLBACK

  for (const service of SERVICES) {
    const value = interests.resolveContactInterest(interests.FALLBACK_CONTACT_INTERESTS, service.contactInterestId).value

    for (const code of codes) {
      const label = fallback[service.id]?.ctaBtn?.[code]
      assert.equal(typeof label, 'string', `${code} is missing ${service.id}.ctaBtn`)
      assert.ok(label.trim().length > 0, `${code} has an empty ${service.id}.ctaBtn`)
      assert.notEqual(label, value, `${code} ctaBtn is the raw API value rather than a label`)
      assert.notEqual(label, service.contactInterestId, `${code} ctaBtn is the raw id rather than a label`)
    }
    assert.equal(typeof at(bundles.en, serviceKey(service, 'title')), 'string', 'the CTA hint still names the service')
  }
})

test('12. the shared CTA keys exist in every language, with the placeholder intact', () => {
  for (const code of codes) {
    const eyebrow = at(bundles[code], 'services.ctaEyebrow')
    const a11y = at(bundles[code], 'services.ctaAccessibility')

    assert.ok(eyebrow?.trim(), `${code} is missing services.ctaEyebrow`)
    assert.ok(a11y?.trim(), `${code} is missing services.ctaAccessibility`)
    assert.ok(a11y.includes('{service}'), `${code} services.ctaAccessibility lost its {service} placeholder`)
  }
})

/* ═══════════════ Unknown ids ═══════════════ */

test('13. an unknown service id never produces a contact interest', () => {
  for (const id of ['sell-your-property', 'Architecture', 'interior design', 'interior_design', '', undefined, '../contact']) {
    assert.equal(getService(id), undefined, `${String(id)} resolved to a service`)
  }
})

/* ═══════════════ One definition ═══════════════ */

test('14. the mapping is declared in exactly one file', () => {
  assert.equal(
    (read('src/features/services/services-data.ts').match(/contactInterestId:/g) ?? []).length,
    // the type declaration, plus one per service
    1 + SERVICES.length
  )

  const screen = read('src/app/services/[service].tsx')
  assert.ok(screen.includes('service.contactInterestId'), 'the screen does not use the mapping')
  assert.equal(/service(Param)?\s*===\s*'/.test(screen), false,
    'the screen compares service ids by hand instead of reading the mapping')
  assert.equal(/interestType:\s*t\(/.test(screen), false, 'a translated string is being sent as the API value')
})

test('15. the CTA pushes, so Back returns to the service page', () => {
  const screen = read('src/app/services/[service].tsx')

  assert.ok(/router\.push\(\{\s*pathname: '\/contact'/.test(screen), 'the CTA does not push /contact')
  assert.equal(/router\.replace\(\s*\{?\s*(pathname: )?'\/contact'/.test(screen), false,
    'replacing would drop the service page from history')
})

/* ═══════════════ The old hardcoded list is gone ═══════════════ */

test('16. no hardcoded reason list or bundled reason labels remain', () => {
  const api = read('src/features/contact/contact-api.ts')
  assert.equal(/export const CONTACT_REASONS/.test(api), false, 'CONTACT_REASONS is back')
  assert.equal(/export function reasonKey/.test(api), false, 'reasonKey is back')

  for (const code of codes) {
    assert.equal(at(bundles[code], 'contact.reasons'), undefined,
      `${code} still carries contact.reasons — labels belong to the shared contract`)
  }
})
