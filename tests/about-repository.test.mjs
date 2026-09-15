// About content loading: API, device cache and the shared repository.
//
// Home and /about read one source (features/about/about-repository.ts). These
// tests pin the precedence (bundled → cached → server), that it only ever
// moves forward (a slow cache read cannot overwrite server content), that a
// failure keeps what is shown, and that two readers share one request.
//
// Pure: every module is transpiled and run with its imports stubbed.

import test, { before, beforeEach } from 'node:test'
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
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

/* ── Stubs ─────────────────────────────────────────────────────────────── */

let api = async () => ({})
const apiCalls = []

const storage = new Map()
let storageFailure = null
const storageReads = []
const storageWrites = []

const asyncStorage = {
  __esModule: true,
  default: {
    getItem: async (key) => {
      storageReads.push(key)
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

let content
let aboutApi
let cache
let repo

before(() => {
  const localized = load('src/features/localization/localized-content.ts')
  content = load('src/features/about/about-content.ts', { '@/features/localization/localized-content': localized })
  aboutApi = load('src/features/about/about-api.ts', {
    '@/features/about/about-content': content,
    '@/services/api-client': { apiRequest: (p) => { apiCalls.push(p); return api(p) } },
  })
  cache = load('src/features/about/about-cache.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    '@/features/about/about-content': content,
  })
  repo = load('src/features/about/about-repository.ts', {
    '@/features/about/about-api': aboutApi,
    '@/features/about/about-cache': cache,
  })
})

beforeEach(() => {
  api = async () => ({})
  apiCalls.length = 0
  storage.clear()
  storageFailure = null
  storageReads.length = 0
  storageWrites.length = 0
  repo.resetAboutContentMemory()
})

const KEY = 'varlikent_about_content_v1'

const deferred = () => {
  let resolve
  const promise = new Promise((res) => { resolve = res })
  return { promise, resolve }
}

const settle = () => new Promise((resolve) => setImmediate(resolve))

const doc = (heading, extra = {}) => ({
  success: true,
  about: { heroHeading: { sourceLang: 'en', en: heading }, team: [{ name: 'Excluded' }], _id: 'x', ...extra },
})

const headingOf = (entry) => content.resolveAboutContent(entry.content, 'en').heroHeading

/** Subscribes and records every publication as [origin, heading]. */
const record = () => {
  const events = []
  const unsubscribe = repo.subscribeAboutContent((entry) => events.push([entry.origin, headingOf(entry)]))
  return { events, unsubscribe }
}

/* ══════════════ API ══════════════ */

test('the API reads GET /about and normalizes it', async () => {
  api = async () => doc('Server heading')
  const result = await aboutApi.fetchAboutContent()

  assert.deepEqual(apiCalls, ['/about'])
  assert.equal(content.resolveAboutContent(result, 'en').heroHeading, 'Server heading')
  assert.equal(JSON.stringify(result).includes('Excluded'), false)
})

test('the API returns null on failure or unusable payloads, and never throws', async () => {
  api = async () => { throw new Error('offline') }
  assert.equal(await aboutApi.fetchAboutContent(), null)

  api = async () => ({ success: true, about: {} })
  assert.equal(await aboutApi.fetchAboutContent(), null)
})

/* ══════════════ Cache ══════════════ */

test('a valid cached document loads', async () => {
  storage.set(KEY, JSON.stringify(content.normalizeAboutContent(doc('Cached heading'))))
  const cached = await cache.readCachedAboutContent()
  assert.equal(content.resolveAboutContent(cached, 'en').heroHeading, 'Cached heading')
})

test('a corrupt, empty or foreign cache is ignored', async () => {
  for (const raw of ['not json', '', '{}', '[]', 'null', '{"about":{}}', JSON.stringify({ team: [{ name: 'x' }] })]) {
    storage.set(KEY, raw)
    assert.equal(await cache.readCachedAboutContent(), null, `${JSON.stringify(raw)} was accepted`)
  }
})

test('storage failures read as no cache, and writes fail silently', async () => {
  storageFailure = new Error('storage unavailable')
  assert.equal(await cache.readCachedAboutContent(), null)
  await assert.doesNotReject(cache.writeCachedAboutContent(content.FALLBACK_ABOUT_CONTENT))
})

test('what is cached is the normalized document — no team, no ids', async () => {
  await cache.writeCachedAboutContent(content.normalizeAboutContent(doc('Stored')))
  const stored = storage.get(KEY)
  assert.equal(stored.includes('Excluded'), false)
  assert.equal(stored.includes('_id'), false)
})

/* ══════════════ The shared repository ══════════════ */

test('cached content is published first, then the server’s replaces it and is cached', async () => {
  storage.set(KEY, JSON.stringify(content.normalizeAboutContent(doc('Cached heading'))))
  const response = deferred()
  api = () => response.promise
  const { events } = record()

  const done = repo.refreshAboutContent()
  await settle()
  assert.deepEqual(events, [['cache', 'Cached heading']])

  response.resolve(doc('Server heading'))
  assert.equal(await done, true)
  assert.deepEqual(events, [['cache', 'Cached heading'], ['server', 'Server heading']])
  await settle()
  assert.equal(JSON.parse(storage.get(KEY)).heroHeading.en, 'Server heading', 'fresh content was not cached')
  assert.equal(headingOf(repo.peekAboutContent()), 'Server heading')
})

test('a server failure keeps the cached content and leaves the cache untouched', async () => {
  storage.set(KEY, JSON.stringify(content.normalizeAboutContent(doc('Cached heading'))))
  const before = storage.get(KEY)
  api = async () => { throw new Error('offline') }
  const { events } = record()

  assert.equal(await repo.refreshAboutContent(), false)
  await settle()

  assert.deepEqual(events, [['cache', 'Cached heading']])
  assert.equal(storage.get(KEY), before)
  assert.equal(storageWrites.length, 0)
  assert.equal(repo.peekAboutContent().origin, 'cache')
})

test('no cache and no server publishes nothing, so the bundled fallback stays', async () => {
  api = async () => { throw new Error('offline') }
  const { events } = record()

  assert.equal(await repo.refreshAboutContent(), false)
  await settle()

  assert.deepEqual(events, [])
  assert.equal(repo.peekAboutContent(), null)
})

test('a slow cache read that finishes after the server answered is discarded', async () => {
  const slowRead = deferred()
  const realGet = asyncStorage.default.getItem
  asyncStorage.default.getItem = () => slowRead.promise
  api = async () => doc('Server heading')

  try {
    const { events } = record()
    assert.equal(await repo.refreshAboutContent(), true)
    assert.deepEqual(events, [['server', 'Server heading']])

    slowRead.resolve(JSON.stringify(content.normalizeAboutContent(doc('Stale cached heading'))))
    await settle()
    assert.deepEqual(events, [['server', 'Server heading']], 'stale cache overwrote fresher content')
    assert.equal(headingOf(repo.peekAboutContent()), 'Server heading')
  } finally {
    asyncStorage.default.getItem = realGet
  }
})

test('Home and /about refreshing together share one request and one publication', async () => {
  const response = deferred()
  api = () => response.promise
  const { events } = record()

  const home = repo.refreshAboutContent()
  const aboutScreen = repo.refreshAboutContent()
  response.resolve(doc('Server heading'))

  assert.deepEqual(await Promise.all([home, aboutScreen]), [true, true])
  assert.equal(apiCalls.length, 1)
  assert.deepEqual(events.filter(([origin]) => origin === 'server'), [['server', 'Server heading']])
  await settle()
  assert.equal(storageWrites.length, 1)
})

test('a screen opened later starts from the session’s content and does not re-read the cache', async () => {
  api = async () => doc('Server heading')
  await repo.refreshAboutContent()
  const readsAfterHome = storageReads.length

  // What /about's hook reads for its first frame.
  assert.equal(headingOf(repo.peekAboutContent()), 'Server heading')

  await repo.refreshAboutContent()
  assert.equal(storageReads.length, readsAfterHome, 'the cache was read again despite fresher memory')
})

test('newer content reaches every subscriber, and nothing after unsubscribing', async () => {
  const home = record()
  const aboutScreen = record()

  api = async () => doc('First')
  await repo.refreshAboutContent()
  aboutScreen.unsubscribe()

  api = async () => doc('Second')
  await repo.refreshAboutContent()

  assert.deepEqual(home.events.map(([, heading]) => heading), ['First', 'Second'])
  assert.deepEqual(aboutScreen.events.map(([, heading]) => heading), ['First'])
})
