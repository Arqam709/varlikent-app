// Contact interests on mobile after Phase 1B: admin-managed, with a cache.
//
// The backend list is now edited by admins at runtime. Phase 1A's design
// already allowed for that — `ContactInterest.id` is a plain string and the
// normalizer keeps well-formed unknown ids — and these tests prove it holds:
// a brand-new interest renders, is labelled, ordered and submitted correctly
// without an app release, and a disabled one disappears.
//
// They also cover the last-successful cache (contact-interests-cache.ts):
// valid cache used, corrupt cache ignored, fresh data wins, failures never
// break or block the form.
//
// Pure: both modules are transpiled and run with their imports stubbed.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const load = (relative, imports) => {
  const { outputText } = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => {
    if (id in imports) return imports[id]
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

/* ── Stubs ─────────────────────────────────────────────────────────────── */

/** Replaced per test: what GET /contact/interests does. */
let api = async () => ({})

const storage = new Map()
let storageFailure = null
const storageWrites = []

const asyncStorage = {
  __esModule: true,
  default: {
    getItem: async (key) => {
      if (storageFailure) throw storageFailure
      return storage.has(key) ? storage.get(key) : null
    },
    setItem: async (key, value) => {
      if (storageFailure) throw storageFailure
      storageWrites.push(key)
      storage.set(key, value)
    },
  },
}

let interests
let cache

before(() => {
  interests = load('src/features/contact/contact-interests.ts', {
    '@/services/api-client': { apiRequest: (p) => api(p) },
  })
  cache = load('src/features/contact/contact-interests-cache.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    '@/features/contact/contact-interests': interests,
  })
})

beforeEach(() => {
  api = async () => ({})
  storage.clear()
  storageWrites.length = 0
  storageFailure = null
})

/** A promise plus the functions that settle it, to control arrival order. */
const deferred = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

const INVESTMENT = {
  id: 'investment_consultation',
  value: 'Investment Consultation',
  labels: { en: 'Investment Consultation', tr: 'Yatırım Danışmanlığı' },
  order: 0,
}

/** What the backend serves after an admin adds Investment Consultation and disables Construction. */
const served = () => ({
  success: true,
  interests: [
    ...interests.FALLBACK_CONTACT_INTERESTS.filter((i) => i.id !== 'construction').map((i) => structuredClone(i)),
    structuredClone(INVESTMENT),
  ],
})

/* ══════════════ Admin-created interests, no app release ══════════════ */

test('a well-formed id this build has never seen is kept', () => {
  const list = interests.normalizeContactInterests(served())
  const investment = interests.findContactInterest(list, 'investment_consultation')

  assert.ok(investment, 'an unknown id was dropped')
  assert.deepEqual(investment, INVESTMENT)
})

test('the fetch returns admin-created interests as served', async () => {
  api = async () => served()
  const list = await interests.fetchContactInterests()
  assert.ok(interests.findContactInterest(list, 'investment_consultation'))
})

test('a new interest shows its translation, and English where it has none', () => {
  const investment = interests.findContactInterest(interests.normalizeContactInterests(served()), 'investment_consultation')

  assert.equal(interests.contactInterestLabel(investment, 'tr'), 'Yatırım Danışmanlığı')
  for (const language of ['en', 'ar', 'de', 'ru', 'ur']) {
    assert.equal(interests.contactInterestLabel(investment, language), 'Investment Consultation', language)
  }
})

test('selecting a new interest by id submits its canonical value', () => {
  const list = interests.normalizeContactInterests(served())
  const selected = interests.resolveContactInterest(list, 'investment_consultation')

  assert.equal(selected.value, 'Investment Consultation')
  assert.notEqual(selected.value, interests.contactInterestLabel(selected, 'tr'))
})

test('the server’s order is used, so an interest moved to the top renders first', () => {
  const list = interests.normalizeContactInterests(served())
  assert.equal(list[0].id, 'investment_consultation')
})

test('a disabled interest disappears — omitted by the server, or flagged', () => {
  const omitted = interests.normalizeContactInterests(served())
  assert.equal(interests.findContactInterest(omitted, 'construction'), undefined)

  const flagged = interests.normalizeContactInterests([...served().interests, {
    id: 'land_acquisition', value: 'Land Acquisition', labels: { en: 'Land Acquisition' }, order: 20, enabled: false,
  }])
  assert.equal(interests.findContactInterest(flagged, 'land_acquisition'), undefined)
})

test('malformed server entries are still ignored beside valid new ones', () => {
  const list = interests.normalizeContactInterests([
    INVESTMENT,
    { id: 'Investment Consultation', value: 'Bad Id', labels: { en: 'x' }, order: 1 },
    { id: 'no_english', value: 'No English', labels: { tr: 'Yok' }, order: 1 },
    { ...INVESTMENT, id: 'duplicate_value' },
  ])
  assert.deepEqual(list.map((i) => i.id), ['investment_consultation'])
})

/* ══════════════ Preselection ══════════════ */

test('a service link whose interest was disabled lands on General, never a hidden option', () => {
  const list = interests.normalizeContactInterests(served())

  for (const key of ['construction', 'Construction']) {
    const selected = interests.resolveContactInterest(list, key)
    assert.equal(selected.id, 'general')
    assert.equal(selected.value, 'General')
  }
})

test('a link to an admin-created interest is selected once the server list arrives', () => {
  const key = interests.requestedContactInterestKey('investment_consultation')

  assert.equal(key, 'investment_consultation', 'the key must stay unresolved until a list offers it')
  assert.equal(interests.resolveContactInterest(interests.FALLBACK_CONTACT_INTERESTS, key).id, 'general')
  assert.equal(interests.resolveContactInterest(interests.normalizeContactInterests(served()), key).id, 'investment_consultation')
})

test('a missing or unusable route param requests General', () => {
  for (const param of [undefined, '', ['construction'], 42, null]) {
    assert.equal(interests.requestedContactInterestKey(param), 'general')
  }
})

/* ══════════════ The cache ══════════════ */

const KEY = 'varlikent_contact_interests_v1'

test('a valid cached list is read back normalized', async () => {
  storage.set(KEY, JSON.stringify(served()))

  const cached = await cache.readCachedContactInterests()

  assert.equal(cached[0].id, 'investment_consultation')
  assert.equal(interests.findContactInterest(cached, 'construction'), undefined)
})

test('a corrupt, empty or foreign cache is treated as no cache', async () => {
  for (const raw of ['not json', '{"interests":"nope"}', '[]', '{}', 'null', JSON.stringify([{ id: 'Bad Id' }]), '']) {
    storage.set(KEY, raw)
    assert.equal(await cache.readCachedContactInterests(), null, `${JSON.stringify(raw)} was accepted`)
  }
})

test('storage failures read as no cache and writes fail silently', async () => {
  storageFailure = new Error('storage unavailable')

  assert.equal(await cache.readCachedContactInterests(), null)
  await assert.doesNotReject(cache.writeCachedContactInterests(interests.FALLBACK_CONTACT_INTERESTS))
})

test('a written list reads back identically', async () => {
  const list = interests.normalizeContactInterests(served())
  await cache.writeCachedContactInterests(list)
  assert.deepEqual(await cache.readCachedContactInterests(), list)
})

test('refresh: the cache is shown first, then the fresh server list replaces it and is cached', async () => {
  storage.set(KEY, JSON.stringify({ interests: interests.FALLBACK_CONTACT_INTERESTS }))
  const response = deferred()
  api = () => response.promise

  const reports = []
  cache.refreshContactInterests((list, origin) => reports.push({ origin, ids: list.map((i) => i.id) }))

  await settle()
  assert.deepEqual(reports.map((r) => r.origin), ['cache'])

  response.resolve(served())
  await settle()

  assert.deepEqual(reports.map((r) => r.origin), ['cache', 'server'])
  assert.equal(reports[1].ids[0], 'investment_consultation')
  assert.equal(JSON.parse(storage.get(KEY)).interests[0].id, 'investment_consultation', 'the fresh list was not cached')
})

test('refresh: a server failure leaves the cached list and does not touch the cache', async () => {
  storage.set(KEY, JSON.stringify(served()))
  const before = storage.get(KEY)
  api = async () => { throw new Error('offline') }

  const reports = []
  cache.refreshContactInterests((list, origin) => reports.push(origin))
  await settle()
  await settle()

  assert.deepEqual(reports, ['cache'])
  assert.equal(storage.get(KEY), before)
  assert.equal(storageWrites.length, 0)
})

test('refresh: no cache and no server reports nothing, so the bundled list stays', async () => {
  api = async () => { throw new Error('offline') }

  const reports = []
  cache.refreshContactInterests((list, origin) => reports.push(origin))
  await settle()
  await settle()

  assert.deepEqual(reports, [])
})

test('refresh: a cache read that finishes after the server answered is discarded', async () => {
  const slowRead = deferred()
  const realGet = asyncStorage.default.getItem
  asyncStorage.default.getItem = () => slowRead.promise
  api = async () => served()

  try {
    const reports = []
    cache.refreshContactInterests((list, origin) => reports.push(origin))
    await settle()
    assert.deepEqual(reports, ['server'])

    slowRead.resolve(JSON.stringify({ interests: interests.FALLBACK_CONTACT_INTERESTS }))
    await settle()
    assert.deepEqual(reports, ['server'], 'stale cached data overwrote the fresh list')
  } finally {
    asyncStorage.default.getItem = realGet
  }
})

test('refresh: after cancel nothing is reported, but a late server list is still cached', async () => {
  storage.set(KEY, JSON.stringify({ interests: interests.FALLBACK_CONTACT_INTERESTS }))
  const response = deferred()
  api = () => response.promise

  const reports = []
  const cancel = cache.refreshContactInterests((list, origin) => reports.push(origin))
  cancel()

  response.resolve(served())
  await settle()
  await settle()

  assert.deepEqual(reports, [])
  assert.equal(JSON.parse(storage.get(KEY)).interests[0].id, 'investment_consultation')
})

/* ══════════════ The Contact screen wiring ══════════════ */

test('the screen renders the bundled list first and never waits for storage or network', () => {
  const screen = read('src/app/contact.tsx')

  assert.ok(screen.includes('useState<readonly ContactInterest[]>(FALLBACK_CONTACT_INTERESTS)'))
  assert.ok(screen.includes('refreshContactInterests((next, origin) =>'))
  assert.equal(/useEffect\(\s*async/.test(screen), false, 'an async effect would suggest the form waits')
})

test('only a live server response enables source: mobile', () => {
  const screen = read('src/app/contact.tsx')

  assert.ok(screen.includes("if (origin === 'server') setInterestsFromServer(true);"))
  assert.ok(screen.includes("source: interestsFromServer ? 'mobile' : undefined"))
})

test('the screen resolves its selection against the current list and submits the canonical value', () => {
  const screen = read('src/app/contact.tsx')

  assert.ok(screen.includes('requestedContactInterestKey(interestTypeParam)'))
  assert.ok(screen.includes('resolveContactInterest(interests, reasonKey)'))
  assert.ok(screen.includes('interestType: selectedInterest.value'))
})

test('ContactInterest.id stays a plain string, never the known-id union', () => {
  const source = read('src/features/contact/contact-interests.ts')
  const type = source.slice(source.indexOf('export type ContactInterest = {'), source.indexOf('};', source.indexOf('export type ContactInterest = {')))

  assert.match(type, /\bid: string;/)
  assert.equal(type.includes('KnownContactInterestId'), false)
})
