// Contact interests — the mobile half of the shared contract (Phase 1).
//
// Mobile used to hardcode eight reasons that never included Troubleshoot. The
// list now comes from GET /api/contact/interests, with a bundled fallback of
// the same shape. These tests pin what matters about that change:
//
//   - the fallback contains every current option, including Troubleshoot
//   - a server response is matched by id/value and read defensively
//   - the visible label follows the language, the submitted value never does
//   - an unreachable endpoint leaves the Contact screen usable
//
// Pure: the module's one runtime import (the API client) is stubbed. No React
// Native, no rendering, no snapshots.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let apiImpl = async () => ({})
const requested = []

let mod

before(() => {
  const source = fs.readFileSync(path.join(ROOT, 'src/features/contact/contact-interests.ts'), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })

  const module = { exports: {} }
  const require = (id) => {
    if (id === '@/services/api-client') {
      return {
        apiRequest: async (p) => {
          requested.push(p)
          return apiImpl(p)
        },
      }
    }
    throw new Error(`contact-interests.ts may only import the API client; it imported ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  mod = module.exports
})

beforeEach(() => {
  apiImpl = async () => ({})
  requested.length = 0
})

/** The backend contract, pinned: id → legacy value, in order. */
const PINNED = [
  ['buying', 'Buying'],
  ['renting', 'Renting'],
  ['selling', 'Selling'],
  ['renovation', 'Renovation'],
  ['interior_design', 'Interior Design'],
  ['architecture', 'Architecture'],
  ['construction', 'Construction'],
  ['general', 'General'],
  ['troubleshoot', 'Troubleshoot'],
]

const LANGS = ['en', 'tr', 'ar', 'de', 'ru', 'ur']

const plain = (value) => JSON.parse(JSON.stringify(value))

/* ══════════════ THE FALLBACK ══════════════ */

test('the bundled fallback contains Troubleshoot', () => {
  const troubleshoot = mod.FALLBACK_CONTACT_INTERESTS.find((i) => i.id === 'troubleshoot')
  assert.ok(troubleshoot, 'the option this phase exists to deliver is missing')
  assert.equal(troubleshoot.value, 'Troubleshoot')
})

test('the fallback keeps Construction', () => {
  assert.equal(mod.FALLBACK_CONTACT_INTERESTS.find((i) => i.id === 'construction')?.value, 'Construction')
})

test('the fallback matches the backend contract exactly, in order', () => {
  assert.deepEqual(
    mod.FALLBACK_CONTACT_INTERESTS.map((i) => [i.id, i.value]),
    PINNED,
    'the bundled list has drifted from backend/config/contactInterests.js'
  )
  const orders = mod.FALLBACK_CONTACT_INTERESTS.map((i) => i.order)
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b))
})

test('every fallback entry has a label in all six languages', () => {
  for (const interest of mod.FALLBACK_CONTACT_INTERESTS) {
    for (const lang of LANGS) {
      assert.ok(typeof interest.labels[lang] === 'string' && interest.labels[lang].trim(),
        `${interest.id} has no ${lang} label`)
    }
  }
})

test('the fallback is already in normalized form', () => {
  assert.deepEqual(mod.normalizeContactInterests(plain(mod.FALLBACK_CONTACT_INTERESTS)),
    plain(mod.FALLBACK_CONTACT_INTERESTS))
})

/* ══════════════ NORMALIZING A SERVER RESPONSE ══════════════ */

test('a reordered response is sorted by order with labels still attached', () => {
  const served = plain(mod.FALLBACK_CONTACT_INTERESTS)
  const normalized = mod.normalizeContactInterests({ success: true, interests: [...served].reverse() })

  assert.deepEqual(normalized.map((i) => i.id), PINNED.map(([id]) => id))
  for (const interest of normalized) {
    const original = served.find((s) => s.id === interest.id)
    assert.deepEqual(interest.labels, original.labels, `${interest.id} picked up another entry's labels`)
  }
})

test('the response body and a bare array are both accepted', () => {
  const served = plain(mod.FALLBACK_CONTACT_INTERESTS)
  assert.deepEqual(mod.normalizeContactInterests({ success: true, interests: served }), served)
  assert.deepEqual(mod.normalizeContactInterests(served), served)
})

test('malformed entries are ignored and unknown fields are never copied', () => {
  const good = plain(mod.FALLBACK_CONTACT_INTERESTS[0])

  const result = mod.normalizeContactInterests({
    interests: [
      null,
      'Buying',
      { value: 'No Id', labels: { en: 'No id' }, order: 1 },
      { id: 'Interior Design', value: 'Spaced Id', labels: { en: 'x' }, order: 1 },
      { id: 'no_value', labels: { en: 'No value' }, order: 1 },
      { id: 'padded_value', value: ' Buying ', labels: { en: 'Padded' }, order: 1 },
      { id: 'no_english', value: 'No English', labels: { tr: 'Türkçe' }, order: 1 },
      { id: 'retired', value: 'Retired', labels: { en: 'Retired' }, order: 1, enabled: false },
      { ...good, recipients: [{ email: 'leak@example.test' }], somethingNew: { nested: true } },
      { ...good, value: 'Duplicate id' },
      { id: 'duplicate_value', value: good.value, labels: { en: 'Dup' }, order: 2 },
    ],
  })

  assert.deepEqual(result.map((i) => i.id), [good.id])
  assert.deepEqual(Object.keys(result[0]).sort(), ['id', 'labels', 'order', 'value'])
})

test('an entry with no numeric order still renders, after the ordered ones', () => {
  const result = mod.normalizeContactInterests([
    { id: 'later', value: 'Later', labels: { en: 'Later' } },
    { id: 'first', value: 'First', labels: { en: 'First' }, order: 1 },
  ])
  assert.deepEqual(result.map((i) => i.id), ['first', 'later'])
})

test('garbage payloads normalize to nothing rather than throwing', () => {
  for (const payload of [undefined, null, '', 'oops', 7, {}, { interests: 'nope' }]) {
    assert.deepEqual(mod.normalizeContactInterests(payload), [])
  }
})

/* ══════════════ LABELS VS VALUES ══════════════ */

test('the label follows the language, falling back to English then the value', () => {
  const general = mod.findContactInterest(mod.FALLBACK_CONTACT_INTERESTS, 'general')

  assert.equal(mod.contactInterestLabel(general, 'en'), 'General Enquiry')
  assert.equal(mod.contactInterestLabel(general, 'tr'), 'Genel Talep')
  assert.equal(mod.contactInterestLabel(general, 'xx'), 'General Enquiry')
  assert.equal(mod.contactInterestLabel({ id: 'x', value: 'Raw', labels: {}, order: 1 }, 'tr'), 'Raw')
})

test('a translated label maps back to one stable id and one legacy value', () => {
  for (const interest of mod.FALLBACK_CONTACT_INTERESTS) {
    for (const lang of LANGS) {
      const label = mod.contactInterestLabel(interest, lang)
      const owners = mod.FALLBACK_CONTACT_INTERESTS.filter((i) => mod.contactInterestLabel(i, lang) === label)
      assert.equal(owners.length, 1, `${lang} "${label}" belongs to more than one option`)
      assert.equal(owners[0].value, interest.value)
    }
  }
})

test('the selected option submits its legacy value in every language', () => {
  // What the screen submits is resolveContactInterest(...).value — language is
  // not an input to that at all.
  const interiorDesign = mod.resolveContactInterest(mod.FALLBACK_CONTACT_INTERESTS, 'interior_design')
  assert.equal(interiorDesign.value, 'Interior Design')

  const troubleshoot = mod.resolveContactInterest(mod.FALLBACK_CONTACT_INTERESTS, 'troubleshoot')
  assert.equal(troubleshoot.value, 'Troubleshoot')
  assert.notEqual(mod.contactInterestLabel(troubleshoot, 'tr'), troubleshoot.value,
    'a translated label must never be what gets submitted')
})

/* ══════════════ PRESELECTION ══════════════ */

test('a preselection resolves by stable id', () => {
  assert.equal(mod.resolveContactInterest(mod.FALLBACK_CONTACT_INTERESTS, 'construction').id, 'construction')
})

test('a preselection still resolves by legacy value, for older links', () => {
  // `/contact?interestType=Interior%20Design` is what older service links and
  // shared URLs carry.
  assert.equal(mod.resolveContactInterest(mod.FALLBACK_CONTACT_INTERESTS, 'Interior Design').id, 'interior_design')
})

test('an unknown or missing preselection falls back to General', () => {
  for (const key of [undefined, null, '', 'gardening', 'Sorun Giderme', 42]) {
    assert.equal(mod.resolveContactInterest(mod.FALLBACK_CONTACT_INTERESTS, key).id, 'general', String(key))
  }
})

test('a list without General still yields a selectable option', () => {
  const onlyBuying = [plain(mod.FALLBACK_CONTACT_INTERESTS[0])]
  assert.equal(mod.resolveContactInterest(onlyBuying, 'nothing').id, 'buying')
})

/* ══════════════ FETCHING ══════════════ */

test('the endpoint is GET /contact/interests and its payload is normalized', async () => {
  const served = plain(mod.FALLBACK_CONTACT_INTERESTS)
  apiImpl = async () => ({ success: true, interests: [...served].reverse() })

  const result = await mod.fetchContactInterests()

  assert.deepEqual(requested, ['/contact/interests'])
  assert.deepEqual(result.map((i) => i.id), PINNED.map(([id]) => id))
})

test('a network failure returns null so the screen keeps its list', async () => {
  apiImpl = async () => { throw new Error('Network request failed') }
  assert.equal(await mod.fetchContactInterests(), null)
})

test('an empty or malformed response returns null rather than an empty list', async () => {
  for (const body of [{ success: true, interests: [] }, { success: true }, 'garbage', null]) {
    apiImpl = async () => body
    assert.equal(await mod.fetchContactInterests(), null, JSON.stringify(body))
  }
})
