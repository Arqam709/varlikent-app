// Design boards for signed-in users: MongoDB is the truth, AsyncStorage a cache.
//
// Runs the REAL sync, cache and API modules — including the
// app's real apiRequest — against an in-memory AsyncStorage and a fake `fetch`
// that behaves like /api/design-boards (owner-scoped, `_id`s, 404 for another
// user's board).
//
// What matters most here:
//   • there is no signed-out mode: restoring is not signed out, and only a
//     complete session can own boards
//   • boards from the old signed-out version are never read, moved or deleted
//   • a signed-in user sees cached boards first, then the server's, and the
//     cache is replaced by every server answer
//   • nothing is shown or cached as saved unless the server accepted it
//   • one account's cached boards are never readable by another account

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

/* ── In-memory AsyncStorage ─────────────────────────────────────────────── */

const storage = new Map()
const touchedKeys = []
const asyncStorage = {
  __esModule: true,
  default: {
    getItem: async (key) => { touchedKeys.push(key); return storage.has(key) ? storage.get(key) : null },
    setItem: async (key, value) => { touchedKeys.push(key); storage.set(key, value) },
    removeItem: async (key) => { touchedKeys.push(key); storage.delete(key) },
  },
}

/* ── A fake /api/design-boards ──────────────────────────────────────────── */

const API = 'https://api.test/api'
const USER_A = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const USER_B = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const TOKENS = { 'token-a': USER_A, 'token-b': USER_B }

const server = { boards: new Map(), requests: [], offline: false, failNext: null, nextId: 1 }

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

globalThis.fetch = async (url, init = {}) => {
  const method = init.method ?? 'GET'
  const auth = init.headers?.Authorization ?? ''
  server.requests.push({ method, url, auth, body: init.body ? JSON.parse(init.body) : undefined })

  if (server.offline) throw new TypeError('Network request failed')
  if (server.failNext) {
    const status = server.failNext
    server.failNext = null
    return json(status, { success: false, message: 'Internal Server Error' })
  }

  const userId = TOKENS[auth.replace('Bearer ', '')]
  if (!userId) return json(401, { success: false, message: 'Not authorized, invalid token' })

  const pathname = url.replace(API, '')
  const [, , id] = pathname.split('/')
  const owned = [...server.boards.values()].filter((b) => b.user === userId)
  const publicBoard = ({ user, ...board }) => board
  const now = () => new Date(Date.UTC(2026, 8, 16, 12, 0, server.nextId++)).toISOString()

  if (method === 'GET' && !id) {
    const boards = owned.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    return json(200, { success: true, count: boards.length, boards: boards.map(publicBoard) })
  }
  if (method === 'POST') {
    const { clientId, ...content } = JSON.parse(init.body)
    const existing = owned.find((b) => clientId && b.clientId === clientId)
    if (existing) {
      Object.assign(existing, content, { updatedAt: now() })
      return json(200, { success: true, board: publicBoard(existing) })
    }
    const stamp = now()
    const board = { _id: server.nextId.toString(16).padStart(24, 'f'), user: userId, clientId, version: 1, ...content, createdAt: stamp, updatedAt: stamp }
    server.boards.set(board._id, board)
    return json(201, { success: true, board: publicBoard(board) })
  }

  const board = owned.find((b) => b._id === id)
  if (!board) return json(404, { success: false, message: 'Design board not found' })

  if (method === 'PUT') {
    Object.assign(board, JSON.parse(init.body), { updatedAt: now() })
    return json(200, { success: true, board: publicBoard(board) })
  }
  if (method === 'DELETE') {
    server.boards.delete(id)
    return json(200, { success: true, message: 'Design board deleted' })
  }
  return json(405, { success: false })
}

/* ── Modules ────────────────────────────────────────────────────────────── */

let db
let cache
let sync

before(() => {
  process.env.EXPO_PUBLIC_API_URL = API
  const remoteImage = load('src/utils/remote-image.ts')
  const sp = load('src/features/studio-palette/studio-palette.ts', { '@/utils/remote-image': remoteImage })
  const options = load('src/features/design-my-space/design-options.ts')
  const config = load('src/constants/config.ts')
  const apiClient = load('src/services/api-client.ts', { '@/constants/config': config })

  db = load('src/features/design-my-space/design-board.ts', {
    '@/features/design-my-space/design-options': options,
    '@/features/studio-palette/studio-palette': sp,
    '@/utils/remote-image': remoteImage,
  })
  cache = load('src/features/design-my-space/design-board-cache.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    '@/features/design-my-space/design-board': db,
  })
  const api = load('src/features/design-my-space/design-board-api.ts', {
    '@/features/design-my-space/design-board': db,
    '@/services/api-client': apiClient,
  })
  sync = load('src/features/design-my-space/design-board-sync.ts', {
    '@/features/design-my-space/design-board-api': api,
    '@/features/design-my-space/design-board': db,
    '@/features/design-my-space/design-board-cache': cache,
    '@/services/api-client': apiClient,
  })
})

beforeEach(() => {
  storage.clear()
  touchedKeys.length = 0
  server.boards.clear()
  server.requests.length = 0
  server.offline = false
  server.failNext = null
})

/** Where builds before sign-in was required kept signed-out boards. */
const LEGACY_ANONYMOUS_KEY = 'varlikent_design_boards_v1'
const cacheKey = (userId) => `varlikent_design_boards_account_v1:${userId}`

const accountA = { userId: USER_A, token: 'token-a' }
const accountB = { userId: USER_B, token: 'token-b' }

const draft = (overrides = {}) => ({
  room: 'living-room',
  style: 'warm',
  wall: { label: 'Warm Sand', color: '#e8ddd0' },
  floor: { label: 'Dark Oak', color: '#4a3728' },
  materials: [{ name: 'Calacatta Marble', color: '#f2ede8' }],
  lighting: 'warm',
  ...overrides,
})

const newBoard = (overrides = {}, id = db.createDesignBoardId()) => ({
  ...db.boardFromDraft(draft(), { id, now: '2026-09-16T10:00:00.000Z' }),
  ...overrides,
})

const serverBoard = (userId, overrides = {}) => {
  const board = {
    _id: (server.nextId++).toString(16).padStart(24, 'e'),
    user: userId,
    version: 1,
    ...draft(),
    createdAt: '2026-09-10T10:00:00.000Z',
    updatedAt: '2026-09-10T10:00:00.000Z',
    ...overrides,
  }
  server.boards.set(board._id, board)
  return board
}

const cachedIds = (userId) => JSON.parse(storage.get(cacheKey(userId)) ?? '[]').map((b) => b._id)

/* ═══════════════ Server boards in the app model ═══════════════ */

test('a server board becomes an app board by its _id, checked like any stored record', () => {
  const raw = { _id: 'abcdefabcdefabcdefabcdef', clientId: 'dms-x', version: 1, ...draft(), createdAt: '2026-09-16T10:00:00.000Z', updatedAt: '2026-09-16T11:00:00.000Z' }
  const board = db.designBoardFromServer(raw)

  assert.equal(board.id, 'abcdefabcdefabcdefabcdef')
  assert.equal('_id' in board || 'clientId' in board, false)
  assert.equal(db.isServerDesignBoardId(board.id), true)
  assert.equal(db.isServerDesignBoardId(db.createDesignBoardId()), false, 'a device id looks like a server id')

  for (const broken of [{ _id: undefined }, { _id: 'dms-1' }, { room: 'attic' }, { version: 2 }, { wall: null }]) {
    assert.equal(db.designBoardFromServer({ ...raw, ...broken }), null, JSON.stringify(broken))
  }
})

test('the payload sent to the server holds only board content', () => {
  const payload = db.designBoardPayload(newBoard({ id: 'abcdefabcdefabcdefabcdef' }))
  assert.deepEqual(Object.keys(payload).sort(), ['floor', 'lighting', 'materials', 'room', 'style', 'wall'])
})

/* ═══════════════ 11. Access: signed in only ═══════════════ */

test('11. restoring a session is neither signed in nor signed out', () => {
  for (const [userId, token] of [[null, null], [USER_A, 'token-a']]) {
    assert.deepEqual(sync.designMySpaceAccess('loading', userId, token), { state: 'restoring' })
  }
})

test('11b. a signed-out visitor has no owner, so no board can be loaded, saved or deleted', () => {
  assert.deepEqual(sync.designMySpaceAccess('unauthenticated', null, null), { state: 'signed-out' })
  // A stale user or token without an authenticated status is still signed out.
  assert.deepEqual(sync.designMySpaceAccess('unauthenticated', USER_A, 'token-a'), { state: 'signed-out' })
  // An incomplete session never becomes an owner.
  assert.deepEqual(sync.designMySpaceAccess('authenticated', USER_A, null), { state: 'signed-out' })
  assert.deepEqual(sync.designMySpaceAccess('authenticated', null, 'token-a'), { state: 'signed-out' })
})

test('11c. only a complete signed-in session owns boards', () => {
  assert.deepEqual(sync.designMySpaceAccess('authenticated', USER_A, 'token-a'), {
    state: 'signed-in',
    owner: { userId: USER_A, token: 'token-a' },
  })
})

test('11d. every board operation requires an account — there is no device fallback', async () => {
  assert.equal('listDesignBoards' in sync || 'designBoardOwnerKey' in sync, false)

  server.offline = true
  assert.equal(await sync.saveDesignBoardFor(accountA, newBoard()), null)
  assert.equal(await sync.deleteDesignBoardFor(accountA, 'abcdefabcdefabcdefabcdef'), false)
  assert.equal([...storage.keys()].length, 0, 'a failed account write left something on the device')
})

/* ═══════════════ 9-10. Signed in: cache first, then the server ═══════════════ */

test('9. cached boards are delivered before the server answers', async () => {
  const cachedBoard = serverBoard(USER_A, { room: 'bedroom' })
  await cache.writeCachedAccountBoards(USER_A, [db.designBoardFromServer(cachedBoard)])
  server.boards.clear()

  let cachedSeen = null
  let requestsWhenCached = null
  await sync.loadDesignBoards(accountA, (boards) => {
    cachedSeen = boards
    requestsWhenCached = server.requests.length
  })

  assert.deepEqual(cachedSeen.map((b) => b.room), ['bedroom'])
  assert.equal(requestsWhenCached, 0, 'the cache was only offered after the network')
})

test('10. a successful server fetch replaces the list AND the cache — the server wins', async () => {
  // The cache holds a board since deleted on another device, and lacks a new one.
  const stale = serverBoard(USER_A, { room: 'office' })
  await cache.writeCachedAccountBoards(USER_A, [db.designBoardFromServer(stale)])
  server.boards.delete(stale._id)
  const older = serverBoard(USER_A, { room: 'kitchen', updatedAt: '2026-09-11T10:00:00.000Z' })
  const newer = serverBoard(USER_A, { room: 'bathroom', updatedAt: '2026-09-12T10:00:00.000Z' })

  const result = await sync.loadDesignBoards(accountA)

  assert.equal(result.origin, 'server')
  assert.equal(result.failed, false)
  assert.deepEqual(result.boards.map((b) => b.id), [newer._id, older._id])
  assert.deepEqual(cachedIds(USER_A), [newer._id, older._id], 'the cache was not refreshed from the server')
  assert.equal(server.requests[0].auth, 'Bearer token-a')
})

test('offline or failing: the cached list stays, marked as not confirmed, and the cache is untouched', async () => {
  const board = serverBoard(USER_A)
  await sync.loadDesignBoards(accountA)
  const before = storage.get(cacheKey(USER_A))

  for (const failure of [() => { server.offline = true }, () => { server.failNext = 503 }]) {
    failure()
    const result = await sync.loadDesignBoards(accountA)
    assert.equal(result.origin, 'cache')
    assert.equal(result.failed, true)
    assert.deepEqual(result.boards.map((b) => b.id), [board._id])
    assert.equal(storage.get(cacheKey(USER_A)), before)
    server.offline = false
  }
})

test('a server board this build cannot read is skipped without hiding the rest', async () => {
  const good = serverBoard(USER_A)
  serverBoard(USER_A, { room: 'attic' })

  const result = await sync.loadDesignBoards(accountA)
  assert.deepEqual(result.boards.map((b) => b.id), [good._id])
})

test('corrupt cache entries are ignored rather than thrown at the screen', async () => {
  for (const raw of ['{{{', 'null', '{"boards":[]}', JSON.stringify([{ _id: 'nope' }, 'x'])]) {
    storage.set(cacheKey(USER_A), raw)
    assert.deepEqual(await cache.readCachedAccountBoards(USER_A), [], raw)
  }
  assert.equal(cache.accountDesignBoardsCacheKey('../../evil'), null)
})

/* ═══════════════ Writes go through the server ═══════════════ */

test('a first save creates the board with its device id as clientId; the next save updates it', async () => {
  const draftBoard = newBoard()

  const created = await sync.saveDesignBoardFor(accountA, draftBoard)
  assert.equal(db.isServerDesignBoardId(created.id), true, 'the saved board kept its device id')
  const post = server.requests.at(-1)
  assert.equal(post.method, 'POST')
  assert.equal(post.body.clientId, draftBoard.id)
  assert.equal('id' in post.body || 'createdAt' in post.body || 'user' in post.body, false)
  assert.deepEqual(cachedIds(USER_A), [created.id])

  const updated = await sync.saveDesignBoardFor(accountA, { ...created, lighting: 'night' })
  assert.equal(server.requests.at(-1).method, 'PUT')
  assert.equal(server.requests.at(-1).url, `${API}/design-boards/${created.id}`)
  assert.equal(updated.id, created.id)
  assert.equal(updated.lighting, 'night')
  assert.equal(server.boards.size, 1)
  assert.deepEqual(cachedIds(USER_A), [created.id])
})

test('re-saving a device board after a lost response does not create a duplicate', async () => {
  const draftBoard = newBoard()
  await sync.saveDesignBoardFor(accountA, draftBoard)
  // The screen never learned the server id, so it saves the device board again.
  const again = await sync.saveDesignBoardFor(accountA, { ...draftBoard, style: 'classic' })

  assert.equal(server.boards.size, 1)
  assert.equal(again.style, 'classic')
  assert.equal(JSON.parse(storage.get(cacheKey(USER_A))).length, 1)
})

test('a failed save is reported, and nothing is cached or kept locally as if it had worked', async () => {
  for (const failure of [() => { server.offline = true }, () => { server.failNext = 500 }]) {
    failure()
    assert.equal(await sync.saveDesignBoardFor(accountA, newBoard()), null)
    server.offline = false
  }
  assert.equal(storage.has(cacheKey(USER_A)), false)
  assert.equal(storage.has(LEGACY_ANONYMOUS_KEY), false, 'a failed account save fell back to the old device store')

  assert.equal(await sync.saveDesignBoardFor({ ...accountA, token: 'expired' }, newBoard()), null)
})

test('delete: removed from the cache only once the server confirms; already-gone counts as done', async () => {
  const keep = serverBoard(USER_A, { updatedAt: '2026-09-11T10:00:00.000Z' })
  const remove = serverBoard(USER_A, { updatedAt: '2026-09-12T10:00:00.000Z' })
  await sync.loadDesignBoards(accountA)

  server.offline = true
  assert.equal(await sync.deleteDesignBoardFor(accountA, remove._id), false)
  assert.deepEqual(cachedIds(USER_A), [remove._id, keep._id], 'an unconfirmed delete touched the cache')
  server.offline = false

  assert.equal(await sync.deleteDesignBoardFor(accountA, remove._id), true)
  assert.deepEqual(cachedIds(USER_A), [keep._id])

  // Deleted on another device already: the server says 404, which is the goal.
  server.boards.delete(keep._id)
  assert.equal(await sync.deleteDesignBoardFor(accountA, keep._id), true)
  assert.deepEqual(cachedIds(USER_A), [])
})

/* ═══════════════ 12. Old anonymous boards: left alone ═══════════════ */

test('12. boards from the signed-out version are never read, uploaded, overwritten or deleted', async () => {
  // Written exactly as the previous app version wrote them.
  const legacy = [newBoard({}, 'dms-legacy-1'), newBoard({ room: 'kitchen' }, 'dms-legacy-2')]
  storage.set(LEGACY_ANONYMOUS_KEY, JSON.stringify(legacy))
  const original = storage.get(LEGACY_ANONYMOUS_KEY)

  // A whole signed-in session: load, save, delete, log out.
  serverBoard(USER_A)
  const loaded = await sync.loadDesignBoards(accountA)
  const saved = await sync.saveDesignBoardFor(accountA, newBoard())
  await sync.deleteDesignBoardFor(accountA, saved.id)
  await sync.forgetAccountDesignBoards(USER_A)

  assert.equal(loaded.boards.some((b) => b.id.startsWith('dms-legacy')), false, 'an anonymous board appeared in the account')
  assert.equal(touchedKeys.includes(LEGACY_ANONYMOUS_KEY), false, 'the old anonymous store was accessed')
  assert.equal(storage.get(LEGACY_ANONYMOUS_KEY), original, 'the old anonymous store was changed')
  assert.equal(server.requests.some((r) => JSON.stringify(r.body ?? '').includes('dms-legacy')), false,
    'an anonymous board was uploaded to the account')
})

/* ═══════════════ 13. Accounts on one device ═══════════════ */

test('13. user B never sees user A’s cached boards, and logging out removes only A’s copy', async () => {
  const boardA = serverBoard(USER_A, { room: 'bedroom' })
  await sync.loadDesignBoards(accountA)
  assert.deepEqual(cachedIds(USER_A), [boardA._id])

  // A logs out; B logs in on the same phone, while offline.
  await sync.forgetAccountDesignBoards(USER_A)
  assert.equal(storage.has(cacheKey(USER_A)), false)

  server.offline = true
  let cachedForB = null
  const offlineB = await sync.loadDesignBoards(accountB, (boards) => { cachedForB = boards })
  assert.deepEqual(cachedForB, [])
  assert.deepEqual(offlineB.boards, [])
  server.offline = false

  const boardB = serverBoard(USER_B, { room: 'office' })
  const onlineB = await sync.loadDesignBoards(accountB)
  assert.deepEqual(onlineB.boards.map((b) => b.id), [boardB._id])
  assert.equal(server.requests.at(-1).auth, 'Bearer token-b')
})

test('13b. even WITHOUT a logout, each account reads only its own cache key', async () => {
  const boardA = serverBoard(USER_A)
  const boardB = serverBoard(USER_B)
  await sync.loadDesignBoards(accountA)
  await sync.loadDesignBoards(accountB)

  server.offline = true
  let seenByB = null
  await sync.loadDesignBoards(accountB, (boards) => { seenByB = boards })
  assert.deepEqual(seenByB.map((b) => b.id), [boardB._id])
  assert.deepEqual(cachedIds(USER_A), [boardA._id])

  // B deleting or saving never reaches A's entry.
  server.offline = false
  await sync.deleteDesignBoardFor(accountB, boardB._id)
  await sync.saveDesignBoardFor(accountB, newBoard())
  assert.deepEqual(cachedIds(USER_A), [boardA._id])

  // And B cannot delete A's board by id: the server answers 404 for B...
  server.failNext = null
  const before = server.boards.size
  await sync.deleteDesignBoardFor(accountB, boardA._id)
  assert.equal(server.boards.size, before, 'B deleted A’s board')
})

test('logout clears the outgoing user’s cached boards', () => {
  const auth = fs.readFileSync(path.join(ROOT, 'src/features/auth/auth-context.tsx'), 'utf8')
  const logout = auth.slice(auth.indexOf('const logout = useCallback'))
  assert.ok(logout.slice(0, 700).includes('forgetAccountDesignBoards(outgoingUserId)'))
})

/* ═══════════════ The shared vocabulary ═══════════════ */

const BACKEND_VOCABULARY = path.resolve(ROOT, '..', 'varlikent', 'backend', 'config', 'designBoardVocabulary.js')

test('the backend accepts exactly the app’s room, style and lighting ids', { skip: !fs.existsSync(BACKEND_VOCABULARY) && 'backend not checked out beside the app' }, async () => {
  const backend = await import(`file://${BACKEND_VOCABULARY.replace(/\\/g, '/')}`)
  const options = load('src/features/design-my-space/design-options.ts')
  const sp = load('src/features/studio-palette/studio-palette.ts', { '@/utils/remote-image': load('src/utils/remote-image.ts') })

  assert.deepEqual(backend.DESIGN_ROOM_IDS, [...options.ROOM_IDS])
  assert.deepEqual(backend.DESIGN_STYLE_IDS, [...options.STYLE_IDS])
  assert.deepEqual(backend.DESIGN_LIGHTING_IDS, [...options.LIGHTING_IDS])
  assert.equal(backend.DESIGN_BOARD_VERSION, db.DESIGN_BOARD_VERSION)
  assert.equal(backend.DESIGN_BOARD_LIMITS.materials, sp.PALETTE_LIMITS.materials)
  assert.equal(backend.DESIGN_BOARD_LIMITS.label, sp.PALETTE_LIMITS.label)
})

/* ═══════════════ Why a save failed ═══════════════ */

test('a save that fails says WHY: the server, the session, or the connection', async () => {
  const reasons = []

  // A backend deployment without /api/design-boards answers 404 with an HTML
  // error page — exactly what a not-yet-deployed backend does. That is the
  // server's problem, and must not be blamed on the phone's connection.
  const realFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(
    '<!DOCTYPE html><html><body><pre>Cannot POST /api/design-boards</pre></body></html>',
    { status: 404, headers: { 'Content-Type': 'text/html' } }
  )
  try {
    assert.equal(await sync.saveDesignBoardFor(accountA, newBoard(), { onError: (error) => reasons.push(error) }), null)
  } finally {
    globalThis.fetch = realFetch
  }
  assert.equal(reasons.length, 1, 'the reason was swallowed')
  assert.equal(reasons[0].status, 404)
  assert.equal(sync.designBoardSaveErrorKey(reasons[0]), 'designMySpace.saveFailedServer')

  // An expired or rejected session: the fake API answers 401 for a bad token.
  reasons.length = 0
  await sync.saveDesignBoardFor({ ...accountA, token: 'expired' }, newBoard(), { onError: (error) => reasons.push(error) })
  assert.equal(sync.designBoardSaveErrorKey(reasons[0]), 'designMySpace.saveFailedSession')

  // A genuine connection failure keeps the connection wording.
  server.offline = true
  reasons.length = 0
  await sync.saveDesignBoardFor(accountA, newBoard(), { onError: (error) => reasons.push(error) })
  assert.equal(reasons[0].kind, 'network')
  assert.equal(sync.designBoardSaveErrorKey(reasons[0]), 'designMySpace.saveFailed')
  server.offline = false

  // A server error is the server, not the phone.
  server.failNext = 500
  reasons.length = 0
  await sync.saveDesignBoardFor(accountA, newBoard(), { onError: (error) => reasons.push(error) })
  assert.equal(sync.designBoardSaveErrorKey(reasons[0]), 'designMySpace.saveFailedServer')

  // An unknown, non-API failure still gets a usable message.
  assert.equal(sync.designBoardSaveErrorKey(new Error('boom')), 'designMySpace.saveFailedServer')
  assert.equal(sync.designBoardSaveErrorKey(null), 'designMySpace.saveFailedServer')
})

test('every save-failure message exists in all six languages', () => {
  const keys = ['designMySpace.saveFailed', 'designMySpace.saveFailedSession', 'designMySpace.saveFailedServer']
  for (const code of ['en', 'tr', 'ar', 'de', 'ru', 'ur']) {
    const bundle = load(`src/features/localization/translations/${code}.ts`, { './en': {} })[code]
    for (const key of keys) {
      const value = key.split('.').reduce((node, part) => node?.[part], bundle)
      assert.equal(typeof value, 'string', `${code} is missing ${key}`)
      assert.ok(value.trim(), `${code} ${key} is empty`)
    }
  }
})

test('the screen shows the reason it was given, not one fixed message', () => {
  const screen = fs.readFileSync(path.join(ROOT, 'src/app/design-my-space.tsx'), 'utf8')
  assert.ok(screen.includes('designBoardSaveErrorKey(failure)'))
  assert.ok(screen.includes('{t(saveErrorKey)}'))
  // The old single-message path is gone.
  assert.equal(screen.includes("t('designMySpace.saveFailed')"), false, 'the screen still hard-codes one failure message')
})

test('a failure is logged safely: development only, and nothing private in it', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/features/design-my-space/design-board-sync.ts'), 'utf8')
  const report = source.slice(source.indexOf('function reportBoardFailure'), source.indexOf('export async function saveDesignBoardFor'))

  assert.ok(/typeof __DEV__ === 'undefined' || !__DEV__/.test(report),
    'diagnostics are not development-only (and safe where __DEV__ is absent)')

  // The logged line interpolates exactly two things: the action word and a
  // detail built only from ApiError's own safe fields.
  const interpolations = report.match(/\$\{[^}]+\}/g) ?? []
  assert.deepEqual(interpolations, ['${action}', '${detail}'])
  assert.ok(report.includes('[error.kind, error.status, error.code, error.message]'))

  // Nothing that could carry the session or the user's design.
  for (const secret of ['owner.token', 'board.', 'JSON.stringify', 'payload']) {
    assert.equal(report.includes(secret), false, `the log could include ${secret}`)
  }
})
