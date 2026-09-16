// The Design Board: the model, and the device it is saved on.
//
// A board is the user's own work, stored locally so it survives an app
// restart, works signed out, and works offline. Two properties matter most:
//
//   1. Nothing on the device is trusted. A record written by a future version,
//      a half-written record, or corrupted storage must degrade to "that board
//      does not exist" and never to a crash on a screen someone is looking at.
//   2. A board keeps what the user chose. Palette items have no stable ids, so
//      a board stores SNAPSHOTS — and an admin changing the palette next month
//      cannot silently rewrite a design somebody saved.
//
// Pure: transpiled modules, an in-memory AsyncStorage.

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

const storage = new Map()
let storageFailure = null

const asyncStorage = {
  __esModule: true,
  default: {
    getItem: async (key) => {
      if (storageFailure) throw storageFailure
      return storage.has(key) ? storage.get(key) : null
    },
    setItem: async (key, value) => {
      if (storageFailure) throw storageFailure
      storage.set(key, value)
    },
    removeItem: async (key) => { storage.delete(key) },
  },
}

const STORE = 'varlikent_design_boards_v1'

let db
let boards
let sp

before(() => {
  const remoteImage = load('src/utils/remote-image.ts')
  sp = load('src/features/studio-palette/studio-palette.ts', { '@/utils/remote-image': remoteImage })
  const options = load('src/features/design-my-space/design-options.ts')

  db = load('src/features/design-my-space/design-board.ts', {
    '@/features/design-my-space/design-options': options,
    '@/features/studio-palette/studio-palette': sp,
    '@/utils/remote-image': remoteImage,
  })
  boards = load('src/features/design-my-space/design-board-repository.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    '@/features/design-my-space/design-board': db,
  })
})

beforeEach(() => {
  storage.clear()
  storageFailure = null
})

const draft = (overrides = {}) => ({
  room: 'living-room',
  style: 'warm',
  wall: { label: 'Warm Sand', color: '#e8ddd0' },
  floor: { label: 'Dark Oak', color: '#4a3728' },
  materials: [{ name: 'Calacatta Marble', color: '#f2ede8' }],
  lighting: 'warm',
  ...overrides,
})

const board = (overrides = {}) => ({
  ...db.boardFromDraft(draft(), { id: 'dms-test-1', now: '2026-09-16T10:00:00.000Z' }),
  ...overrides,
})

/* ═══════════════ The model ═══════════════ */

test('1. a complete draft becomes a board; an incomplete one cannot', () => {
  const made = db.boardFromDraft(draft(), { id: 'dms-a', now: '2026-09-16T10:00:00.000Z' })

  assert.equal(made.version, 1)
  assert.equal(made.id, 'dms-a')
  assert.equal(made.room, 'living-room')
  assert.equal(made.createdAt, '2026-09-16T10:00:00.000Z')
  assert.equal(made.updatedAt, '2026-09-16T10:00:00.000Z')

  for (const missing of ['room', 'style', 'wall', 'floor', 'lighting']) {
    assert.equal(
      db.boardFromDraft(draft({ [missing]: null }), { id: 'x', now: 'n' }),
      null,
      `a board was built with no ${missing}`
    )
  }
})

test('2. zero materials is a valid board; the step is never blocking', () => {
  const empty = draft({ materials: [] })

  assert.equal(db.isStepComplete(empty, 'materials'), true)
  assert.equal(db.firstIncompleteStep(empty), null)
  assert.deepEqual(db.boardFromDraft(empty, { id: 'dms-b', now: 'n' }).materials, [])
})

test('2b. an unanswered step is reported as the first one to return to', () => {
  assert.equal(db.firstIncompleteStep(db.EMPTY_DESIGN_DRAFT), 'room')
  assert.equal(db.firstIncompleteStep(draft({ floor: null })), 'floor')
  assert.equal(db.firstIncompleteStep(draft({ lighting: null })), 'lighting')
})

test('3. a stored record is rejected unless every part of it is valid', () => {
  assert.notEqual(db.normalizeDesignBoard(board()), null)

  const broken = {
    'wrong version': { version: 2 },
    'no version': { version: undefined },
    'unknown room': { room: 'attic' },
    'unknown style': { style: 'brutalist' },
    'unknown lighting': { lighting: 'dawn' },
    'bad id': { id: 'nope/../etc' },
    'empty id': { id: '' },
    'unnamed wall': { wall: { label: '', color: '#ffffff' } },
    'wall colour': { wall: { label: 'Ivory', color: 'white' } },
    'missing floor': { floor: null },
    'bad createdAt': { createdAt: 'whenever' },
  }

  for (const [why, change] of Object.entries(broken)) {
    assert.equal(db.normalizeDesignBoard({ ...board(), ...change }), null, `accepted a board with a ${why}`)
  }

  for (const value of [null, 'x', 7, [], undefined]) {
    assert.equal(db.normalizeDesignBoard(value), null)
  }
})

test('4. materials are normalized: bad entries skipped, duplicates dropped, textures checked', () => {
  const normalized = db.normalizeDesignBoard({
    ...board(),
    materials: [
      { name: ' Oak ', color: '#3d2b1f', image: 'https://cdn.example.com/oak.jpg' },
      { name: 'Oak', color: '#3d2b1f' },
      { name: 'Brass', color: 'gold' },
      { name: '', color: '#ffffff' },
      'nonsense',
      null,
      { name: 'Slate', color: '#333333', image: 'javascript:alert(1)' },
    ],
  })

  assert.deepEqual(normalized.materials, [
    { name: 'Oak', color: '#3d2b1f', image: 'https://cdn.example.com/oak.jpg' },
    { name: 'Slate', color: '#333333' },
  ])
})

test('4b. a board salvages what it can, unlike a palette group', () => {
  // A palette group is all-or-nothing (it mirrors the website). A saved board
  // is the user's own work, so one bad material must not cost them the board.
  assert.equal(sp.sanitizeMaterials([{ name: 'Ok', color: '#ffffff' }, { name: 'Bad', color: 'red' }]), null)
  assert.equal(db.normalizeDesignBoard({ ...board(), materials: [{ name: 'Ok', color: '#ffffff' }, { name: 'Bad', color: 'red' }] }).materials.length, 1)
})

test('5. timestamps: updatedAt falls back to createdAt, never to nothing', () => {
  const normalized = db.normalizeDesignBoard({ ...board(), updatedAt: 'not a date' })
  assert.equal(normalized.updatedAt, normalized.createdAt)
})

test('6. ids are unique, and never an array position', () => {
  const ids = new Set(Array.from({ length: 200 }, () => db.createDesignBoardId()))
  assert.equal(ids.size, 200)
  for (const id of ids) assert.match(id, /^dms-[a-z0-9]+-[a-z0-9]+$/)
})

test('7. nothing mutates its input', () => {
  const source = draft()
  const snapshot = JSON.parse(JSON.stringify(source))

  const made = db.boardFromDraft(source, { id: 'dms-c', now: 'n' })
  made.materials.push({ name: 'Injected', color: '#000000' })
  made.wall.label = 'Changed'

  assert.deepEqual(source, snapshot, 'building a board reached back into the draft')

  const saved = board()
  const copy = JSON.parse(JSON.stringify(saved))
  const edited = db.draftFromBoard(saved)
  edited.wall.label = 'Changed'
  edited.materials.push({ name: 'Injected', color: '#000000' })

  assert.deepEqual(saved, copy, 'editing a draft reached back into the saved board')
})

test('8. toggling materials adds, removes, and identifies by name AND colour', () => {
  const marble = { name: 'Calacatta Marble', color: '#f2ede8' }
  const brass = { name: 'Aged Brass', color: '#C9A35A' }
  // Same name, different colour: a different material after a palette change.
  const otherMarble = { name: 'Calacatta Marble', color: '#ffffff' }

  let chosen = db.toggleMaterial([], marble)
  assert.deepEqual(chosen, [marble])

  chosen = db.toggleMaterial(chosen, brass)
  assert.deepEqual(chosen.map((m) => m.name), ['Calacatta Marble', 'Aged Brass'])

  chosen = db.toggleMaterial(chosen, otherMarble)
  assert.equal(chosen.length, 3, 'a same-named material of a different colour was treated as the same choice')

  chosen = db.toggleMaterial(chosen, marble)
  assert.deepEqual(chosen.map((m) => m.color), ['#C9A35A', '#ffffff'])

  const full = Array.from({ length: 24 }, (_, i) => ({ name: `M${i}`, color: '#123456' }))
  assert.equal(db.toggleMaterial(full, { name: 'One More', color: '#654321' }).length, 24)
})

/* ═══════════════ A palette that changed underneath ═══════════════ */

test('9. a saved board still says what the user chose after the palette changes', async () => {
  // Today: the user saves Warm Sand.
  await boards.saveDesignBoard(board({ id: 'dms-history' }))

  // Next month: an admin replaces the wall finishes entirely.
  const newPalette = [{ label: 'Terracotta', color: '#c96f4a' }]

  const reopened = await boards.getDesignBoard('dms-history')
  assert.deepEqual(reopened.wall, { label: 'Warm Sand', color: '#e8ddd0' },
    'the saved board changed because the palette did')

  // Editing it still offers the saved choice, so the step is not silently lost.
  const offered = db.finishOptionsWithSelection(newPalette, reopened.wall)
  assert.deepEqual(offered.map((f) => f.label), ['Warm Sand', 'Terracotta'])
  assert.equal(db.isSameFinish(offered[0], reopened.wall), true)

  // And a finish still on offer is not duplicated.
  assert.deepEqual(
    db.finishOptionsWithSelection(newPalette, { label: 'Terracotta', color: '#c96f4a' }).map((f) => f.label),
    ['Terracotta']
  )

  const materials = db.materialOptionsWithSelection(
    [{ name: 'Terrazzo', color: '#aabbcc', image: '' }],
    reopened.materials
  )
  assert.deepEqual(materials.map((m) => m.name), ['Calacatta Marble', 'Terrazzo'])
})

/* ═══════════════ The device ═══════════════ */

test('10. create, list, reopen, edit, delete', async () => {
  assert.deepEqual(await boards.listDesignBoards(), [])

  const saved = await boards.saveDesignBoard(board({ id: 'dms-1' }))
  assert.equal(saved.id, 'dms-1')
  assert.equal((await boards.listDesignBoards()).length, 1)

  const reopened = await boards.getDesignBoard('dms-1')
  assert.deepEqual(reopened, saved)

  const edited = { ...reopened, lighting: 'night', updatedAt: '2026-09-17T09:00:00.000Z' }
  await boards.saveDesignBoard(edited)

  const list = await boards.listDesignBoards()
  assert.equal(list.length, 1, 'editing created a second board instead of updating one')
  assert.equal(list[0].lighting, 'night')
  assert.equal(list[0].createdAt, saved.createdAt, 'editing rewrote the creation time')

  assert.equal(await boards.deleteDesignBoard('dms-1'), true)
  assert.deepEqual(await boards.listDesignBoards(), [])
  assert.equal(await boards.getDesignBoard('dms-1'), null)
})

test('11. several boards stay independent, newest activity first', async () => {
  await boards.saveDesignBoard(board({ id: 'dms-old', createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' }))
  await boards.saveDesignBoard(board({ id: 'dms-new', room: 'kitchen', createdAt: '2026-09-15T10:00:00.000Z', updatedAt: '2026-09-15T10:00:00.000Z' }))

  assert.deepEqual((await boards.listDesignBoards()).map((b) => b.id), ['dms-new', 'dms-old'])

  await boards.deleteDesignBoard('dms-new')
  const remaining = await boards.listDesignBoards()

  assert.deepEqual(remaining.map((b) => b.id), ['dms-old'])
  assert.equal(remaining[0].room, 'living-room', 'deleting one board altered another')
})

test('11b. concurrent saves do not lose each other', async () => {
  await Promise.all([
    boards.saveDesignBoard(board({ id: 'dms-a' })),
    boards.saveDesignBoard(board({ id: 'dms-b' })),
    boards.saveDesignBoard(board({ id: 'dms-c' })),
  ])

  assert.deepEqual((await boards.listDesignBoards()).map((b) => b.id).sort(), ['dms-a', 'dms-b', 'dms-c'])
})

test('12. corrupt storage is ignored, never thrown at the screen', async () => {
  for (const raw of ['{{{', 'null', '"x"', '{"boards":[]}', '42']) {
    storage.set(STORE, raw)
    assert.deepEqual(await boards.listDesignBoards(), [], raw)
    assert.equal(await boards.getDesignBoard('dms-1'), null)
  }

  // A damaged list keeps every record that is still readable.
  storage.set(STORE, JSON.stringify([
    board({ id: 'dms-good' }),
    { version: 1, id: 'dms-half' },
    { ...board({ id: 'dms-future' }), version: 99 },
    'nonsense',
    board({ id: 'dms-good' }),
  ]))

  assert.deepEqual((await boards.listDesignBoards()).map((b) => b.id), ['dms-good'])
})

test('13. an unavailable store reports failure instead of pretending to save', async () => {
  storageFailure = new Error('storage unavailable')

  assert.equal(await boards.saveDesignBoard(board()), null)
  assert.equal(await boards.deleteDesignBoard('dms-1'), false)
  assert.deepEqual(await boards.listDesignBoards(), [])
})

test('14. an invalid board is refused rather than written', async () => {
  assert.equal(await boards.saveDesignBoard({ ...board(), room: 'attic' }), null)
  assert.equal(await boards.saveDesignBoard({ ...board(), version: 2 }), null)
  assert.deepEqual(await boards.listDesignBoards(), [])
})

test('15. what is written is a versioned record, readable by this build', async () => {
  await boards.saveDesignBoard(board({ id: 'dms-shape' }))
  const [stored] = JSON.parse(storage.get(STORE))

  assert.equal(stored.version, 1)
  assert.deepEqual(Object.keys(stored).sort(),
    ['createdAt', 'floor', 'id', 'lighting', 'materials', 'room', 'style', 'updatedAt', 'version', 'wall'])
  // Ids for the app's own vocabularies; snapshots for the admin's palette.
  assert.equal(stored.room, 'living-room')
  assert.deepEqual(stored.wall, { label: 'Warm Sand', color: '#e8ddd0' })
})
