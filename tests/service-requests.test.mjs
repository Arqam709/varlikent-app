// Service requests (Interior Design + Renovation) — the app's pure model:
// the form steps and their rules, the payload sent to POST /service-requests,
// the defensive reader for what comes back, and the vocabulary shared with the
// backend.
//
// Pure: modules are transpiled and run directly (type-only imports only).
// The backend parity check is cross-repo and skips when the backend is not
// checked out beside the app.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_CONFIG = path.resolve(ROOT, '..', 'varlikent', 'backend', 'config', 'serviceRequests.js')

const load = (relative) => {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  const require = (id) => {
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

let model
let options
let en

before(() => {
  model = load('src/features/service-requests/service-request.ts')
  options = load('src/features/service-requests/service-request-options.ts')
  en = load('src/features/localization/translations/en.ts').en
})

const complete = (type, extra = {}) =>
  model.emptyServiceRequestForm(type, {
    propertyType: 'apartment',
    rooms: ['living_room'],
    areas: ['kitchen'],
    work: ['plumbing'],
    budget: '500k_1m',
    timeline: 'asap',
    name: 'Ahsan',
    email: 'ahsan@example.com',
    phone: '+90 555 123 4567',
    ...extra,
  })

// ── Steps ────────────────────────────────────────────────────────────────

test('the request stage asks only what the design or plan does not already say', () => {
  // A design already carries room, style, finishes and lighting.
  assert.deepEqual([...model.SERVICE_REQUEST_STEPS.interior_design], ['property', 'budget', 'photos', 'contact', 'review'])
  // A plan already carries everything about the work.
  assert.deepEqual([...model.SERVICE_REQUEST_STEPS.renovation], ['contact', 'review'])
  for (const steps of Object.values(model.SERVICE_REQUEST_STEPS)) assert.equal(steps.includes('rooms'), false)
})

test('an empty form is stopped at the first required step', () => {
  assert.equal(model.firstInvalidStep(model.emptyServiceRequestForm('renovation')), 'property')
  assert.equal(model.firstInvalidStep(complete('renovation', { areas: [] })), 'areas')
  assert.equal(model.firstInvalidStep(complete('renovation', { work: [] })), 'work')
  // Rooms come from the design; they are never a question.
  assert.equal(model.firstInvalidStep(complete('interior_design', { rooms: [] })), null)
  assert.equal(model.firstInvalidStep(complete('interior_design', { timeline: null })), 'budget')
  assert.equal(model.firstInvalidStep(complete('interior_design', { phone: '12' })), 'contact')
  assert.equal(model.firstInvalidStep(complete('interior_design')), null)
  assert.equal(model.firstInvalidStep(complete('renovation')), null)
})

test('photos and notes are never required', () => {
  const form = complete('renovation', { notes: '' })
  assert.equal(model.stepErrorKey(form, 'photos'), null)
  assert.equal(model.stepErrorKey(form, 'review'), null)
})

test('step errors are translation keys that exist', () => {
  const keys = [
    model.stepErrorKey(model.emptyServiceRequestForm('renovation'), 'property'),
    model.stepErrorKey(complete('renovation', { sizeSqm: 'huge' }), 'property'),
    model.stepErrorKey(complete('renovation', { areas: [] }), 'areas'),
    model.stepErrorKey(complete('renovation', { work: [] }), 'work'),
    model.stepErrorKey(complete('renovation', { budget: null }), 'budget'),
    model.stepErrorKey(complete('renovation', { timeline: null }), 'budget'),
    model.stepErrorKey(complete('renovation', { name: ' ' }), 'contact'),
    model.stepErrorKey(complete('renovation', { email: 'x' }), 'contact'),
  ]
  for (const key of keys) {
    assert.ok(key, 'expected an error')
    const value = key.split('.').reduce((node, part) => node?.[part], en)
    assert.equal(typeof value, 'string', `${key} has no English text`)
  }
})

test('size is optional, but when given must be a realistic number', () => {
  assert.equal(model.parseSizeSqm(''), '')
  assert.equal(model.parseSizeSqm(' 120 '), 120)
  assert.equal(model.parseSizeSqm('85,5'), 86)
  assert.equal(model.parseSizeSqm('0'), null)
  assert.equal(model.parseSizeSqm('abc'), null)
  assert.equal(model.parseSizeSqm('1000000'), null)
})

test('choices toggle on and off', () => {
  assert.deepEqual(model.toggleChoice([], 'kitchen'), ['kitchen'])
  assert.deepEqual(model.toggleChoice(['kitchen', 'bathroom'], 'kitchen'), ['bathroom'])
})

// ── Payload ──────────────────────────────────────────────────────────────

test('a direct interior design payload carries ids only, and no design', () => {
  const payload = model.buildServiceRequestPayload(complete('interior_design', { sizeSqm: '120', district: ' Kadıköy ' }), 'sr-key-12345678')
  assert.deepEqual(payload, {
    type: 'interior_design',
    idempotencyKey: 'sr-key-12345678',
    contact: { name: 'Ahsan', email: 'ahsan@example.com', phone: '+90 555 123 4567' },
    property: { type: 'apartment', sizeSqm: 120, district: 'Kadıköy' },
    budget: '500k_1m',
    timeline: 'asap',
    notes: '',
    interiorDesign: { rooms: ['living_room'] },
  })
})

test('a design request sends the board and visualization ids — never their content', () => {
  const payload = model.buildServiceRequestPayload(
    complete('interior_design', { designBoardId: 'a'.repeat(24), generationId: 'b'.repeat(24) }),
    'sr-key-12345678'
  )
  assert.deepEqual(payload.interiorDesign, {
    rooms: ['living_room'],
    designBoardId: 'a'.repeat(24),
    generationId: 'b'.repeat(24),
  })
  assert.equal('design' in payload, false)
})

test('a renovation payload carries areas and work, and nothing from interior design', () => {
  const payload = model.buildServiceRequestPayload(
    complete('renovation', { designBoardId: 'a'.repeat(24), notes: '  Old tiles  ' }),
    'sr-key-12345678'
  )
  assert.deepEqual(payload.renovation, { areas: ['kitchen'], work: ['plumbing'] })
  assert.equal('interiorDesign' in payload, false)
  assert.equal(payload.notes, 'Old tiles')
  // Optional property fields are omitted, not sent empty.
  assert.deepEqual(payload.property, { type: 'apartment' })
})

test('idempotency keys match the backend pattern and differ per attempt', () => {
  const a = model.createServiceRequestIdempotencyKey()
  const b = model.createServiceRequestIdempotencyKey()
  assert.match(a, /^[A-Za-z0-9_-]{8,64}$/)
  assert.notEqual(a, b)
})

// ── Reading the server ───────────────────────────────────────────────────

const serverRequest = {
  _id: 'c'.repeat(24),
  type: 'interior_design',
  status: 'contacted',
  createdAt: '2026-09-28T10:00:00.000Z',
  contact: { name: 'A', email: 'a@b.co', phone: '5551234567' },
  property: { type: 'villa', sizeSqm: 200, district: 'Sarıyer' },
  budget: 'over_2_5m',
  timeline: 'flexible',
  notes: 'Calm',
  interiorDesign: {
    rooms: ['living_room'],
    design: {
      boardId: 'a'.repeat(24),
      generationId: 'b'.repeat(24),
      snapshot: {
        version: 1,
        room: 'living-room',
        style: 'warm',
        wall: { label: 'Warm Sand', color: '#e8ddd0' },
        floor: { label: 'Dark Oak', color: '#4a3728' },
        materials: [{ name: 'Aged Brass', color: '#b08d57' }],
        lighting: 'warm',
      },
    },
  },
  renovation: null,
  photos: [
    { _id: 'd'.repeat(24), kind: 'room_photo', width: 1600, height: 1200 },
    { _id: 'e'.repeat(24), kind: 'visualization', width: 1024, height: 768 },
  ],
}

test('a server request is read into the app model', () => {
  const request = model.serviceRequestFromServer(serverRequest)
  assert.equal(request.id, 'c'.repeat(24))
  assert.equal(request.status, 'contacted')
  assert.deepEqual(request.rooms, ['living_room'])
  assert.equal(request.design.generationId, 'b'.repeat(24))
  assert.equal(request.design.snapshot.wall.label, 'Warm Sand')
  assert.deepEqual(request.photos.map((p) => p.kind), ['room_photo', 'visualization'])
})

test('unusable or partial responses never crash the list', () => {
  assert.equal(model.serviceRequestFromServer(null), null)
  assert.equal(model.serviceRequestFromServer({ _id: 'x', type: 'renovation' }), null)
  assert.equal(model.serviceRequestFromServer({ _id: 'c'.repeat(24), type: 'architecture' }), null)

  const minimal = model.serviceRequestFromServer({ _id: 'c'.repeat(24), type: 'renovation', status: '???' })
  assert.equal(minimal.status, 'submitted')
  assert.deepEqual(minimal.areas, [])
  assert.equal(minimal.design, null)
  assert.deepEqual(minimal.photos, [])
})

test('failed submits map to specific, translated messages', () => {
  const keyFor = (error) => model.serviceRequestErrorKey(error)
  assert.equal(keyFor({ code: 'DESIGN_NOT_FOUND' }), 'serviceRequests.errors.designMissing')
  assert.equal(keyFor({ code: 'PHOTO_UNREADABLE' }), 'serviceRequests.errors.photoInvalid')
  assert.equal(keyFor({ code: 'REQUEST_DAILY_LIMIT' }), 'serviceRequests.errors.dailyLimit')
  assert.equal(keyFor({ kind: 'network' }), 'serviceRequests.errors.network')
  assert.equal(keyFor(null), 'serviceRequests.errors.generic')
})

// ── Vocabulary ───────────────────────────────────────────────────────────

const GROUPS = [
  ['propertyTypes', 'PROPERTY_TYPES', 'PROPERTY_TYPE_LABELS'],
  ['rooms', 'INTERIOR_ROOMS', 'INTERIOR_ROOM_LABELS'],
  ['areas', 'RENOVATION_AREAS', 'RENOVATION_AREA_LABELS'],
  ['work', 'RENOVATION_WORK', 'RENOVATION_WORK_LABELS'],
  ['budgets', 'BUDGETS', 'BUDGET_LABELS'],
  ['timelines', 'TIMELINES', 'TIMELINE_LABELS'],
]

test('every option has an English label', () => {
  for (const [group, list] of GROUPS) {
    for (const option of options[list]) {
      const value = en.serviceRequests.options[group]?.[option.id]
      assert.equal(typeof value, 'string', `${group}.${option.id} has no label`)
    }
  }
})

test('the app and backend offer exactly the same ids', async (t) => {
  if (!fs.existsSync(BACKEND_CONFIG)) {
    t.skip('backend repository not checked out beside the app')
    return
  }
  const backend = await import(pathToFileURL(BACKEND_CONFIG).href)
  for (const [, list, labels] of GROUPS) {
    assert.deepEqual(options[list].map((option) => option.id), Object.keys(backend[labels]), list)
  }
  assert.deepEqual({ ...options.DESIGN_ROOM_TO_REQUEST_ROOM }, { ...backend.DESIGN_ROOM_TO_REQUEST_ROOM })
  assert.equal(options.MAX_REQUEST_PHOTOS, backend.SERVICE_REQUEST_LIMITS.photos)
  assert.equal(options.MAX_REQUEST_NOTES, backend.SERVICE_REQUEST_LIMITS.notes)
})
