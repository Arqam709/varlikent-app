// The Design Board model.
//
// A board is the user's own work, saved to their account (the sync, cache and
// API are covered by design-board-sync.test.mjs). Two properties matter most:
//
//   1. Nothing read back is trusted. A record from a future version, a
//      half-written cache entry or a malformed server response must degrade to
//      "that board does not exist" and never to a crash on a screen.
//   2. A board keeps what the user chose. Palette items have no stable ids, so
//      a board stores SNAPSHOTS — and an admin changing the palette next month
//      cannot silently rewrite a design somebody saved.
//
// Pure: transpiled modules only.

import test, { before } from 'node:test'
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

let db
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

test('9. a saved board still says what the user chose after the palette changes', () => {
  // Today: the user saves Warm Sand; next month it is read back (from the
  // server or the cache) through the same normalization.
  const reopened = db.normalizeDesignBoard(JSON.parse(JSON.stringify(board({ id: 'dms-history' }))))

  // Meanwhile an admin replaced the wall finishes entirely.
  const newPalette = [{ label: 'Terracotta', color: '#c96f4a' }]

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
