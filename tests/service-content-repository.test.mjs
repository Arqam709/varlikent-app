// Service content loading: API, per-service cache and the keyed repository.
//
// Same guarantees as About, per service: cached then live content, only ever
// moving forward, one shared request per service, and no service ever
// touching another's cache or memory.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const load = (relative, imports = {}) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(path.join(ROOT, relative), 'utf8'), {
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

let respond = async () => ({})
const requests = []
const storage = new Map()

const asyncStorage = {
  __esModule: true,
  default: {
    getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: async (key, value) => { storage.set(key, value) },
  },
}

let sc
let api
let cache
let repo

before(() => {
  const localized = load('src/features/localization/localized-content.ts')
  const fallback = load('src/features/services/service-content-fallback.ts')
  sc = load('src/features/services/service-content.ts', {
    '@/features/localization/localized-content': localized,
    '@/features/services/service-content-fallback': fallback,
  })
  api = load('src/features/services/service-content-api.ts', {
    '@/features/services/service-content': sc,
    '@/services/api-client': { apiRequest: (p) => { requests.push(p); return respond(p) } },
  })
  cache = load('src/features/services/service-content-cache.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    '@/features/services/service-content': sc,
  })
  repo = load('src/features/services/service-content-repository.ts', {
    '@/features/services/service-content-api': api,
    '@/features/services/service-content-cache': cache,
  })
})

beforeEach(() => {
  respond = async () => ({})
  requests.length = 0
  storage.clear()
  repo.resetServiceContentMemory()
})

const settle = () => new Promise((resolve) => setImmediate(resolve))
const deferred = () => {
  let resolve
  const promise = new Promise((res) => { resolve = res })
  return { promise, resolve }
}

const doc = (heading) => ({ success: true, fields: { heroHeading: { type: 'text', sourceLang: 'en', en: heading } }, sections: {} })
const headingOf = (id, content) => sc.resolveServicePage(id, content, 'en').hero.heading
const cacheDoc = (id, heading) => JSON.stringify(sc.serializeServiceContent(sc.normalizeServiceContent(id, doc(heading))))

/* ══════════════ API and cache ══════════════ */

test('each service requests its own public page-content document', async () => {
  respond = async () => doc('Server')
  for (const id of ['architecture', 'construction', 'renovation', 'interior-design']) await api.fetchServiceContent(id)
  assert.deepEqual(requests, [
    '/page-content/architecture',
    '/page-content/construction',
    '/page-content/renovation',
    '/page-content/interior-design',
  ])
})

test('the API returns null on failure or a non-document payload', async () => {
  respond = async () => { throw new Error('offline') }
  assert.equal(await api.fetchServiceContent('architecture'), null)
  respond = async () => ({ images: [] })
  assert.equal(await api.fetchServiceContent('architecture'), null)
})

test('the cache is keyed per service', () => {
  assert.equal(cache.serviceContentCacheKey('architecture'), 'varlikent_service_content_v1:architecture')
  assert.equal(cache.serviceContentCacheKey('interior-design'), 'varlikent_service_content_v1:interior-design')
})

test('a valid cached document loads; a corrupt or other page’s document is ignored', async () => {
  storage.set(cache.serviceContentCacheKey('architecture'), cacheDoc('architecture', 'Cached'))
  assert.equal(headingOf('architecture', await cache.readCachedServiceContent('architecture')), 'Cached')

  for (const raw of ['not json', '[]', '{}', cacheDoc('construction', 'Wrong page')]) {
    storage.set(cache.serviceContentCacheKey('architecture'), raw)
    assert.equal(await cache.readCachedServiceContent('architecture'), null, raw)
  }
})

/* ══════════════ Repository ══════════════ */

test('cached content is shown first, then the server’s replaces it and is cached', async () => {
  storage.set(cache.serviceContentCacheKey('renovation'), cacheDoc('renovation', 'Cached'))
  const response = deferred()
  respond = () => response.promise
  const events = []
  repo.subscribeServiceContent('renovation', (entry) => events.push([entry.origin, headingOf('renovation', entry.content)]))

  const done = repo.refreshServiceContent('renovation')
  await settle()
  assert.deepEqual(events, [['cache', 'Cached']])

  response.resolve(doc('Fresh'))
  assert.equal(await done, true)
  assert.deepEqual(events, [['cache', 'Cached'], ['server', 'Fresh']])
  await settle()
  assert.equal(headingOf('renovation', await cache.readCachedServiceContent('renovation')), 'Fresh')
})

test('a late cache read cannot overwrite fresh server content', async () => {
  const slow = deferred()
  const realGet = asyncStorage.default.getItem
  asyncStorage.default.getItem = () => slow.promise
  respond = async () => doc('Fresh')
  try {
    await repo.refreshServiceContent('construction')
    slow.resolve(cacheDoc('construction', 'Stale'))
    await settle()
    const entry = repo.peekServiceContent('construction')
    assert.equal(entry.origin, 'server')
    assert.equal(headingOf('construction', entry.content), 'Fresh')
  } finally {
    asyncStorage.default.getItem = realGet
  }
})

test('two readers of the SAME service share one request', async () => {
  const response = deferred()
  respond = () => response.promise
  const a = repo.refreshServiceContent('architecture')
  const b = repo.refreshServiceContent('architecture')
  response.resolve(doc('Shared'))
  assert.deepEqual(await Promise.all([a, b]), [true, true])
  assert.equal(requests.length, 1)
})

test('DIFFERENT services stay independent: separate requests, memory, caches and listeners', async () => {
  respond = async (p) => doc(p.endsWith('architecture') ? 'Architecture server' : 'Construction server')
  const architectureEvents = []
  const constructionEvents = []
  repo.subscribeServiceContent('architecture', (entry) => architectureEvents.push(headingOf('architecture', entry.content)))
  repo.subscribeServiceContent('construction', (entry) => constructionEvents.push(headingOf('construction', entry.content)))

  await Promise.all([repo.refreshServiceContent('architecture'), repo.refreshServiceContent('construction')])
  await settle()

  assert.equal(requests.length, 2)
  assert.deepEqual(architectureEvents, ['Architecture server'])
  assert.deepEqual(constructionEvents, ['Construction server'])
  assert.equal(headingOf('architecture', await cache.readCachedServiceContent('architecture')), 'Architecture server')
  assert.equal(headingOf('construction', await cache.readCachedServiceContent('construction')), 'Construction server')
  assert.equal(repo.peekServiceContent('renovation'), null)
})

test('a failed server request keeps the cached content', async () => {
  storage.set(cache.serviceContentCacheKey('interior-design'), cacheDoc('interior-design', 'Cached'))
  respond = async () => { throw new Error('offline') }

  assert.equal(await repo.refreshServiceContent('interior-design'), false)
  await settle()

  assert.equal(repo.peekServiceContent('interior-design').origin, 'cache')
  assert.equal(headingOf('interior-design', repo.peekServiceContent('interior-design').content), 'Cached')
})

test('no cache and no server publishes nothing, so the bundled copy stays', async () => {
  respond = async () => { throw new Error('offline') }
  const events = []
  repo.subscribeServiceContent('architecture', (entry) => events.push(entry))
  assert.equal(await repo.refreshServiceContent('architecture'), false)
  await settle()
  assert.deepEqual(events, [])
})
