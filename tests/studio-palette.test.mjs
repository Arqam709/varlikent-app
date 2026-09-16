// Studio Palette: validation, cache and the shared repository.
//
// The palette is admin-managed data reached over the public endpoint the
// website reads. These tests pin the three answers that endpoint can give —
// an override, "no override exists" (palette: null), and no usable answer at
// all — and the precedence bundled → cached → server that keeps Design My
// Space usable offline.
//
// The `palette: null` case is the one worth stating plainly: it is a SUCCESS,
// it restores the bundled defaults, and it must delete a cached override.
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

/* ── Stubs ─────────────────────────────────────────────────────────────── */

let api = async () => ({ success: true, palette: null })
const apiCalls = []

const storage = new Map()
let storageFailure = null
const storageWrites = []
const storageRemovals = []

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
    removeItem: async (key) => {
      if (storageFailure) throw storageFailure
      storageRemovals.push(key)
      storage.delete(key)
    },
  },
}

let sp
let fallback
let paletteApi
let cache
let repo

before(() => {
  const remoteImage = load('src/utils/remote-image.ts')
  sp = load('src/features/studio-palette/studio-palette.ts', { '@/utils/remote-image': remoteImage })
  fallback = load('src/features/studio-palette/studio-palette-fallback.ts', {
    '@/features/studio-palette/studio-palette': sp,
  })
  paletteApi = load('src/features/studio-palette/studio-palette-api.ts', {
    '@/features/studio-palette/studio-palette': sp,
    '@/features/studio-palette/studio-palette-fallback': fallback,
    '@/services/api-client': { apiRequest: (p) => { apiCalls.push(p); return api(p) } },
  })
  cache = load('src/features/studio-palette/studio-palette-cache.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    '@/features/studio-palette/studio-palette': sp,
    '@/features/studio-palette/studio-palette-fallback': fallback,
  })
  repo = load('src/features/studio-palette/studio-palette-repository.ts', {
    '@/features/studio-palette/studio-palette-api': paletteApi,
    '@/features/studio-palette/studio-palette-cache': cache,
    '@/features/studio-palette/studio-palette-fallback': fallback,
  })
})

beforeEach(() => {
  api = async () => ({ success: true, palette: null })
  apiCalls.length = 0
  storage.clear()
  storageFailure = null
  storageWrites.length = 0
  storageRemovals.length = 0
  repo.resetStudioPaletteMemory()
})

const KEY = 'interior-design'
const CACHE_KEY = 'varlikent_studio_palette_v1:interior-design'
const defaults = () => fallback.fallbackStudioPalette(KEY)

const override = () => ({
  _id: '65f0000000000000000000aa',
  pageKey: KEY,
  __v: 3,
  materials: [{ name: ' Terrazzo ', color: '#AABBCC', image: 'https://cdn.example.com/t.jpg' }],
  wallFinishes: [{ label: 'Terracotta', color: '#c96f4a' }],
  floorFinishes: [{ label: 'Travertine', color: '#d9cbb3' }],
})

/* ═══════════════ 1–12. Validation ═══════════════ */

test('1. a valid interior-design palette is used as saved', () => {
  const result = sp.normalizeStudioPaletteResponse({ success: true, palette: override() }, defaults())

  assert.equal(result.kind, 'palette')
  assert.deepEqual(result.palette.wallFinishes, [{ label: 'Terracotta', color: '#c96f4a' }])
  assert.deepEqual(result.palette.floorFinishes, [{ label: 'Travertine', color: '#d9cbb3' }])
  // Names are trimmed; Mongo internals are not carried through.
  assert.deepEqual(result.palette.materials, [
    { name: 'Terrazzo', color: '#AABBCC', image: 'https://cdn.example.com/t.jpg' },
  ])
})

test('2. palette:null means "no override exists", not a failure', () => {
  const result = sp.normalizeStudioPaletteResponse({ success: true, palette: null }, defaults())
  assert.deepEqual(result, { kind: 'defaults' })
})

test('3. a network failure produces no answer at all', async () => {
  api = async () => { throw new Error('offline') }
  assert.equal(await paletteApi.fetchStudioPalette(KEY), null)
})

test('4. a malformed payload is not mistaken for a reset', () => {
  for (const payload of [null, 'x', 42, [], {}, { success: false }, { palette: 'nope' }, { palette: [] }]) {
    assert.equal(sp.normalizeStudioPaletteResponse(payload, defaults()), null, JSON.stringify(payload))
  }
})

test('5. an invalid group falls back on its own, matching the website', () => {
  const cases = [
    { wallFinishes: [{ label: 'Ok', color: 'red' }] },
    { wallFinishes: [] },
    { wallFinishes: 'no' },
    { wallFinishes: [{ label: '', color: '#ffffff' }] },
    { wallFinishes: [{ label: 'x'.repeat(81), color: '#ffffff' }] },
    { wallFinishes: new Array(17).fill({ label: 'Ok', color: '#ffffff' }) },
  ]

  for (const group of cases) {
    const { palette } = sp.normalizeStudioPaletteResponse({ palette: { ...override(), ...group } }, defaults())
    assert.deepEqual(palette.wallFinishes, defaults().wallFinishes, JSON.stringify(group))
    // The other groups are unaffected.
    assert.equal(palette.floorFinishes[0].label, 'Travertine')
  }
})

test('5b. ONE bad item invalidates its whole group, never just itself', () => {
  const { palette } = sp.normalizeStudioPaletteResponse(
    { palette: { wallFinishes: [{ label: 'Good', color: '#ffffff' }, { label: 'Bad', color: 'nope' }] } },
    defaults()
  )
  assert.deepEqual(palette.wallFinishes, defaults().wallFinishes)
})

test('6. a partly valid palette keeps the valid groups and defaults the rest', () => {
  const { palette } = sp.normalizeStudioPaletteResponse(
    { palette: { materials: override().materials } },
    defaults()
  )

  assert.equal(palette.materials[0].name, 'Terrazzo')
  assert.deepEqual(palette.wallFinishes, defaults().wallFinishes)
  assert.deepEqual(palette.floorFinishes, defaults().floorFinishes)
})

test('7. unknown fields on the document and on an item are ignored', () => {
  const { palette } = sp.normalizeStudioPaletteResponse(
    {
      success: true,
      palette: {
        createdAt: '2026-01-01',
        somethingNew: true,
        wallFinishes: [{ label: 'Ivory', color: '#f5f0e8', visible: false, order: 9, _id: 'x' }],
      },
    },
    defaults()
  )
  assert.deepEqual(palette.wallFinishes, [{ label: 'Ivory', color: '#f5f0e8' }])
})

test('8. a usable material image is kept', () => {
  const { palette } = sp.normalizeStudioPaletteResponse(
    { palette: { materials: [{ name: 'Oak', color: '#3d2b1f', image: 'https://res.cloudinary.com/x/a.jpg' }] } },
    defaults()
  )
  assert.equal(palette.materials[0].image, 'https://res.cloudinary.com/x/a.jpg')
})

test('9. an unusable image costs the material its texture, never its place', () => {
  for (const image of ['javascript:alert(1)', 'data:image/png;base64,AAA', 'file:///etc/passwd', '/uploads/a.jpg', 'https://res.cloudinary.com/x/video/upload/a.mp4', 42]) {
    const { palette } = sp.normalizeStudioPaletteResponse(
      { palette: { materials: [{ name: 'Oak', color: '#3d2b1f', image }] } },
      defaults()
    )
    assert.deepEqual(palette.materials, [{ name: 'Oak', color: '#3d2b1f', image: '' }], String(image))
  }
})

test('10. array order IS display order, and is preserved exactly', () => {
  const labels = ['Zinc', 'Ash', 'Moss', 'Bone']
  const { palette } = sp.normalizeStudioPaletteResponse(
    { palette: { wallFinishes: labels.map((label) => ({ label, color: '#123456' })) } },
    defaults()
  )
  assert.deepEqual(palette.wallFinishes.map((f) => f.label), labels)
})

test('11. the input payload is never mutated', () => {
  const payload = { success: true, palette: override() }
  const snapshot = JSON.parse(JSON.stringify(payload))

  sp.normalizeStudioPaletteResponse(payload, defaults())
  assert.deepEqual(payload, snapshot)
})

test('12. the bundled defaults are complete and well formed', () => {
  for (const key of ['interior-design', 'renovation']) {
    const palette = fallback.fallbackStudioPalette(key)

    assert.ok(palette.materials.length >= 1 && palette.materials.length <= 24, `${key} materials`)
    assert.ok(palette.wallFinishes.length >= 1 && palette.wallFinishes.length <= 16, `${key} walls`)
    assert.ok(palette.floorFinishes.length >= 1 && palette.floorFinishes.length <= 16, `${key} floors`)

    for (const item of [...palette.wallFinishes, ...palette.floorFinishes]) {
      assert.ok(item.label.trim(), `${key} has an unnamed finish`)
      assert.match(item.color, /^#[0-9a-fA-F]{6}$/, `${key} ${item.label}`)
    }
    for (const material of palette.materials) {
      assert.ok(material.name.trim(), `${key} has an unnamed material`)
      assert.match(material.color, /^#[0-9a-fA-F]{6}$/, `${key} ${material.name}`)
    }
  }

  // Re-validating the bundled table through the real sanitizer proves the app
  // could not ship a default palette the server would consider invalid.
  const palette = fallback.fallbackStudioPalette('interior-design')
  assert.notEqual(sp.sanitizeMaterials(palette.materials), null)
  assert.notEqual(sp.sanitizeFinishes(palette.wallFinishes), null)
  assert.notEqual(sp.sanitizeFinishes(palette.floorFinishes), null)
})

/* ═══════════════ 13–18. Cache and repository ═══════════════ */

test('13. a cached override shows before the server answers', async () => {
  storage.set(CACHE_KEY, JSON.stringify({ ...defaults(), wallFinishes: [{ label: 'Cached', color: '#111111' }] }))
  const cached = await cache.readCachedStudioPalette(KEY)

  assert.equal(cached.wallFinishes[0].label, 'Cached')
  // The groups the cache did not carry usably still come from the bundle.
  assert.deepEqual(cached.floorFinishes, defaults().floorFinishes)
})

test('13b. a corrupt or empty cache entry is simply absent', async () => {
  for (const raw of ['{{{', 'null', '[]', '"x"', JSON.stringify({ materials: 'no' })]) {
    storage.set(CACHE_KEY, raw)
    assert.equal(await cache.readCachedStudioPalette(KEY), null, raw)
  }

  storageFailure = new Error('storage unavailable')
  assert.equal(await cache.readCachedStudioPalette(KEY), null)
})

test('14. the server replaces the cache, and is what the session keeps', async () => {
  api = async () => ({ success: true, palette: override() })

  assert.equal(await repo.refreshStudioPalette(KEY), true)

  const entry = repo.peekStudioPalette(KEY)
  assert.equal(entry.origin, 'server')
  assert.equal(entry.isOverride, true)
  assert.equal(entry.palette.wallFinishes[0].label, 'Terracotta')
  assert.deepEqual(storageWrites, [CACHE_KEY])
  assert.equal(JSON.parse(storage.get(CACHE_KEY)).wallFinishes[0].label, 'Terracotta')
})

test('15. a late cache read cannot overwrite server content', async () => {
  let releaseCache
  const held = new Promise((resolve) => { releaseCache = resolve })

  storage.set(CACHE_KEY, JSON.stringify({ ...defaults(), wallFinishes: [{ label: 'Stale', color: '#111111' }] }))
  const slowStorage = {
    ...asyncStorage.default,
    getItem: async (key) => { await held; return storage.get(key) ?? null },
  }
  const slowCache = load('src/features/studio-palette/studio-palette-cache.ts', {
    '@react-native-async-storage/async-storage': { __esModule: true, default: slowStorage },
    '@/features/studio-palette/studio-palette': sp,
    '@/features/studio-palette/studio-palette-fallback': fallback,
  })
  const slowRepo = load('src/features/studio-palette/studio-palette-repository.ts', {
    '@/features/studio-palette/studio-palette-api': paletteApi,
    '@/features/studio-palette/studio-palette-cache': slowCache,
    '@/features/studio-palette/studio-palette-fallback': fallback,
  })

  api = async () => ({ success: true, palette: override() })
  await slowRepo.refreshStudioPalette(KEY)
  assert.equal(slowRepo.peekStudioPalette(KEY).palette.wallFinishes[0].label, 'Terracotta')

  releaseCache()
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(slowRepo.peekStudioPalette(KEY).palette.wallFinishes[0].label, 'Terracotta',
    'the stale cached palette overwrote fresher server content')
})

test('16. a server failure keeps the cached palette on screen', async () => {
  storage.set(CACHE_KEY, JSON.stringify({ ...defaults(), wallFinishes: [{ label: 'Cached', color: '#111111' }] }))
  api = async () => { throw new Error('offline') }

  assert.equal(await repo.refreshStudioPalette(KEY), false)
  await new Promise((resolve) => setImmediate(resolve))

  const entry = repo.peekStudioPalette(KEY)
  assert.equal(entry.origin, 'cache')
  assert.equal(entry.palette.wallFinishes[0].label, 'Cached')
  // Nothing was deleted: an unreachable server is not an instruction to reset.
  assert.deepEqual(storageRemovals, [])
})

test('17. an explicit palette:null clears the stale override and restores defaults', async () => {
  storage.set(CACHE_KEY, JSON.stringify({ ...defaults(), wallFinishes: [{ label: 'Old Override', color: '#111111' }] }))
  api = async () => ({ success: true, palette: null })

  assert.equal(await repo.refreshStudioPalette(KEY), true)
  await new Promise((resolve) => setImmediate(resolve))

  const entry = repo.peekStudioPalette(KEY)
  assert.equal(entry.origin, 'server')
  assert.equal(entry.isOverride, false)
  assert.deepEqual(entry.palette.wallFinishes, defaults().wallFinishes)

  assert.deepEqual(storageRemovals, [CACHE_KEY], 'the deleted override is still cached')
  assert.equal(storage.has(CACHE_KEY), false)
})

test('18. concurrent readers share one request and one write', async () => {
  api = async () => ({ success: true, palette: override() })

  const results = await Promise.all([
    repo.refreshStudioPalette(KEY),
    repo.refreshStudioPalette(KEY),
    repo.refreshStudioPalette(KEY),
  ])

  assert.deepEqual(results, [true, true, true])
  assert.deepEqual(apiCalls, ['/studio-palette/interior-design'])
  assert.deepEqual(storageWrites, [CACHE_KEY])
})

test('18b. subscribers are told about newer palettes, and each page is separate', async () => {
  api = async (path) => (path.endsWith('renovation')
    ? { success: true, palette: { wallFinishes: [{ label: 'Reno', color: '#222222' }] } }
    : { success: true, palette: override() })

  const seen = []
  const stop = repo.subscribeStudioPalette(KEY, (entry) => seen.push(entry.palette.wallFinishes[0].label))

  await repo.refreshStudioPalette(KEY)
  await repo.refreshStudioPalette('renovation')

  assert.deepEqual(seen, ['Terracotta'], 'a renovation palette reached an interior-design subscriber')
  assert.equal(repo.peekStudioPalette('renovation').palette.wallFinishes[0].label, 'Reno')

  stop()
  repo.resetStudioPaletteMemory()
  await repo.refreshStudioPalette(KEY)
  assert.equal(seen.length, 1, 'an unsubscribed listener was still called')
})
