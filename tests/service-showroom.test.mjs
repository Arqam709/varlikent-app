// Service showroom gallery (features/services/service-showroom.ts).
//
// The website's "Our Work" carousel data: ShowroomImage records from
// GET /api/showroom/:category, switched per service in Site Settings.

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
let showroom

before(() => {
  const localized = load('src/features/localization/localized-content.ts')
  const fallback = load('src/features/services/service-content-fallback.ts')
  const content = load('src/features/services/service-content.ts', {
    '@/features/localization/localized-content': localized,
    '@/features/services/service-content-fallback': fallback,
  })
  showroom = load('src/features/services/service-showroom.ts', {
    '@/features/localization/localized-content': localized,
    '@/features/services/service-content': content,
    '@/services/api-client': { apiRequest: (p) => { requests.push(p); return respond(p) } },
    '@/utils/remote-image': load('src/utils/remote-image.ts'),
  })
})

beforeEach(() => {
  respond = async () => ({})
  requests.length = 0
})

const item = (overrides) => ({
  _id: 'id', serviceType: 'architecture', url: 'https://res.cloudinary.com/x/image/upload/a.jpg',
  caption: { sourceLang: 'en', en: 'Villa', tr: 'Villa Projesi' }, title: '', order: 0, visible: true,
  createdAt: '2026-01-01', __v: 0, cropUrl: '', width: 0, height: 0, ...overrides,
})

test('visible images are kept in admin order; videos, relative paths and bad entries are omitted', () => {
  const items = showroom.normalizeShowroom({
    success: true,
    images: [
      item({ _id: 'c', order: 2 }),
      item({ _id: 'a', order: 0 }),
      item({ _id: 'video', url: 'https://res.cloudinary.com/x/video/upload/tour.mp4', order: 1 }),
      item({ _id: 'relative', url: '/uploads/a.jpg', order: 1 }),
      item({ _id: 'hidden', visible: false, order: 1 }),
      item({ _id: 'b', order: 1 }),
      item({ _id: 'a', order: 3 }),
      null,
      'bad',
    ],
  })

  assert.deepEqual(items.map((i) => i.id), ['a', 'b', 'c'])
  assert.deepEqual(Object.keys(items[0]).sort(), ['caption', 'id', 'image', 'order', 'title'])
})

test('a response that is not a gallery normalizes to null', () => {
  for (const payload of [null, 'x', {}, { images: 'nope' }]) assert.equal(showroom.normalizeShowroom(payload), null)
  assert.deepEqual(showroom.normalizeShowroom({ images: [] }), [])
})

test('captions resolve per language, then fall back to the title', () => {
  const items = showroom.normalizeShowroom({
    images: [item({ _id: 'a' }), item({ _id: 'b', caption: '', title: { en: 'Kitchen', ar: 'مطبخ' } })],
  })
  assert.deepEqual(showroom.resolveShowroomItems(items, 'tr').map((i) => i.caption), ['Villa Projesi', 'Kitchen'])
  assert.deepEqual(showroom.resolveShowroomItems(items, 'ar').map((i) => i.caption), ['Villa', 'مطبخ'])
})

test('the gallery is on unless the owner switched this service off — Interior Design uses "interior"', () => {
  assert.equal(showroom.isShowroomEnabled({ showroomEnabled: { architecture: false } }, 'architecture'), false)
  assert.equal(showroom.isShowroomEnabled({ showroomEnabled: { interior: false } }, 'interior-design'), false)
  assert.equal(showroom.isShowroomEnabled({ showroomEnabled: { architecture: false } }, 'interior-design'), true)
  assert.equal(showroom.isShowroomEnabled({}, 'construction'), true)
  assert.equal(showroom.isShowroomEnabled(null, 'renovation'), true, 'a failed settings request keeps the website default')
})

test('each service fetches its own showroom category', async () => {
  respond = async () => ({ images: [] })
  for (const id of ['architecture', 'construction', 'renovation', 'interior-design']) await showroom.fetchServiceShowroom(id)
  assert.deepEqual(requests, ['/showroom/architecture', '/showroom/construction', '/showroom/renovation', '/showroom/interior'])

  respond = async () => { throw new Error('offline') }
  assert.equal(await showroom.fetchServiceShowroom('architecture'), null)
})
