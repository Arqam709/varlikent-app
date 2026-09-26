// Room visualizations in the app: the request contract, response handling,
// error codes, the feature flag, and the promise the UI must never make —
// that a visualization is finished when no provider exists.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const load = (relative, imports = {}) => {
  const { outputText } = ts.transpileModule(read(relative), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  })
  const module = { exports: {} }
  const require = (id) => {
    if (id in imports) return imports[id]
    throw new Error(`${relative} imported an unexpected module: ${id}`)
  }
  new Function('exports', 'module', 'require', outputText)(module.exports, module, require)
  return module.exports
}

const API = 'https://api.test/api'
const requests = []
let respond = null

globalThis.fetch = async (url, init = {}) => {
  requests.push({ url, init, body: init.body ? JSON.parse(init.body) : undefined })
  return respond(url, init)
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

let generation
let api
let apiClient

before(() => {
  process.env.EXPO_PUBLIC_API_URL = API
  const config = load('src/constants/config.ts')
  apiClient = load('src/services/api-client.ts', { '@/constants/config': config })
  generation = load('src/features/design-my-space/design-generation.ts')
  api = load('src/features/design-my-space/design-generation-api.ts', {
    '@/constants/config': config,
    '@/features/design-my-space/design-generation': generation,
    '@/services/api-client': apiClient,
  })
})

beforeEach(() => {
  requests.length = 0
  respond = null
})

const ID = '64b7f0c2a1b2c3d4e5f60718'
const BOARD = '11aaaaaaaaaaaaaaaaaaaaaa'
const PHOTO = '22aaaaaaaaaaaaaaaaaaaaaa'

const serverGeneration = (overrides = {}) => ({
  _id: ID,
  status: 'queued',
  boardId: BOARD,
  roomPhotoId: PHOTO,
  board: {
    room: 'living-room', style: 'warm',
    wall: { label: 'Warm Sand', color: '#e8ddd0' },
    floor: { label: 'Dark Oak', color: '#4a3728' },
    materials: [{ name: 'Aged Brass', color: '#b08d57' }],
    lighting: 'night',
  },
  hasResult: false,
  errorCode: null,
  createdAt: '2026-09-18T10:00:00.000Z',
  startedAt: null,
  completedAt: null,
  expiresAt: '2026-12-17T10:00:00.000Z',
  ...overrides,
})

/* ═══════════════ The response contract ═══════════════ */

test('a generation keeps only safe display fields; storage details cannot leak in', () => {
  const normalized = generation.designGenerationFromServer(serverGeneration({
    result: { publicId: 'varlikent/x', deliveryType: 'authenticated' },
    leaseUntil: '2026-09-18T10:05:00.000Z',
    attempts: 2,
    prompt: 'do not keep me',
  }))

  assert.deepEqual(Object.keys(normalized).sort(), [
    'board', 'boardId', 'completedAt', 'createdAt', 'errorCode', 'hasResult', 'id', 'roomPhotoId', 'status',
  ])
  assert.equal(JSON.stringify(normalized).includes('varlikent/x'), false)
  assert.equal(normalized.hasResult, false)
})

test('an unreadable or unknown-status generation is refused', () => {
  for (const broken of [{ _id: 'nope' }, { status: 'rendering' }, { status: 'deleted' }, { boardId: 'x' }, { roomPhotoId: undefined }, { createdAt: 'whenever' }, { board: undefined }, { board: { room: 'x' } }]) {
    assert.equal(generation.designGenerationFromServer(serverGeneration(broken)), null, JSON.stringify(broken))
  }
  assert.equal(generation.designGenerationFromServer(null), null)
})

test('hasResult is only ever true when the server says so', () => {
  assert.equal(generation.designGenerationFromServer(serverGeneration({ hasResult: 'yes' })).hasResult, false)
  assert.equal(generation.designGenerationFromServer(serverGeneration({ status: 'succeeded', hasResult: true })).hasResult, true)
})

/* ═══════════════ The request ═══════════════ */

test('creating sends exactly two ids and a retry key — never a board, prompt or status', async () => {
  respond = () => json(202, { success: true, generation: serverGeneration() })
  const key = generation.createGenerationIdempotencyKey()
  const created = await api.createDesignGeneration('token-a', { boardId: BOARD, roomPhotoId: PHOTO, idempotencyKey: key })

  assert.equal(created.status, 'queued')
  const [request] = requests
  assert.equal(request.url, `${API}/design-generations`)
  assert.equal(request.init.method, 'POST')
  assert.equal(request.init.headers.Authorization, 'Bearer token-a')
  assert.deepEqual(request.body, { boardId: BOARD, roomPhotoId: PHOTO, idempotencyKey: key })
  assert.deepEqual(Object.keys(request.body).sort(), ['boardId', 'idempotencyKey', 'roomPhotoId'])
})

test('retry keys are unique per attempt and match the backend’s format', () => {
  const keys = new Set(Array.from({ length: 50 }, () => generation.createGenerationIdempotencyKey()))
  assert.equal(keys.size, 50)
  for (const key of keys) assert.match(key, /^[A-Za-z0-9_-]{8,64}$/)
})

test('a rejection is an ApiError carrying the backend code; it is never a success', async () => {
  for (const [status, code] of [[503, 'FEATURE_DISABLED'], [404, 'ROOM_PHOTO_NOT_FOUND'], [429, 'GENERATION_ACTIVE_LIMIT'], [409, 'ROOM_PHOTO_EXPIRED']]) {
    respond = () => json(status, { success: false, code, message: 'nope' })
    await assert.rejects(
      api.createDesignGeneration('token-a', { boardId: BOARD, roomPhotoId: PHOTO, idempotencyKey: 'abcdefgh1234' }),
      (err) => err instanceof apiClient.ApiError && err.code === code && err.status === status,
      code
    )
  }

  // A 202 whose body cannot be read is not treated as a queued request.
  respond = () => json(202, { success: true, generation: { _id: 'bad' } })
  await assert.rejects(api.createDesignGeneration('token-a', { boardId: BOARD, roomPhotoId: PHOTO, idempotencyKey: 'abcdefgh1234' }), apiClient.ApiError)

  respond = () => { throw new TypeError('Network request failed') }
  await assert.rejects(api.createDesignGeneration('token-a', { boardId: BOARD, roomPhotoId: PHOTO, idempotencyKey: 'abcdefgh1234' }), (err) => err.kind === 'network')
})

test('history is authenticated, paginated and skips unreadable entries', async () => {
  respond = () => json(200, { success: true, hasMore: true, generations: [serverGeneration(), { _id: 'bad' }] })
  const { generations, hasMore } = await api.fetchDesignGenerations('token-a', { page: 2, limit: 10 })

  assert.deepEqual(generations.map((g) => g.id), [ID])
  assert.equal(hasMore, true)
  assert.equal(requests[0].url, `${API}/design-generations?page=2&limit=10`)
  assert.equal(requests[0].init.headers.Authorization, 'Bearer token-a')
})

test('reading and deleting one generation are scoped by id and token', async () => {
  respond = (url, init) => (init.method === 'DELETE' ? json(200, { success: true }) : json(200, { success: true, generation: serverGeneration() }))
  await api.fetchDesignGeneration('token-a', ID)
  await api.deleteDesignGeneration('token-a', ID)

  assert.deepEqual(requests.map((r) => [r.init.method ?? 'GET', r.url.replace(API, '')]), [
    ['GET', `/design-generations/${ID}`],
    ['DELETE', `/design-generations/${ID}`],
  ])
})

/* ═══════════════ Status and errors ═══════════════ */

test('every backend error code maps to a message that exists in all six languages', () => {
  const codes = ['FEATURE_DISABLED', 'BOARD_NOT_FOUND', 'BOARD_UNUSABLE', 'ROOM_PHOTO_NOT_FOUND', 'ROOM_PHOTO_EXPIRED',
    'GENERATION_ACTIVE_LIMIT', 'GENERATION_DAILY_LIMIT', 'IDEMPOTENCY_KEY_REUSED', 'INVALID_REQUEST', 'GENERATION_NOT_FOUND',
    'SOURCE_PHOTO_UNAVAILABLE', 'NOT_PROCESSED_IN_TIME', 'LEASE_EXPIRED', 'PROVIDER_FAILED', 'PROVIDER_REJECTED_CONTENT']

  const keys = new Set([
    ...codes.map((code) => generation.designGenerationErrorKey({ code })),
    generation.designGenerationErrorKey({ kind: 'network' }),
    generation.designGenerationErrorKey({ kind: 'auth' }),
    generation.designGenerationErrorKey(null),
    ...['queued', 'processing', 'succeeded'].map((status) => generation.designGenerationStatusKey({ status, errorCode: null })),
    'designMySpace.visualize.heading',
    'designMySpace.visualize.body',
    'designMySpace.visualize.request',
    'designMySpace.visualize.requesting',
    'designMySpace.visualize.requestA11y',
    'designMySpace.visualize.tryAgain',
    'designMySpace.visualize.pendingNote',
  ])

  for (const code of ['en', 'tr', 'ar', 'de', 'ru', 'ur']) {
    const bundle = load(`src/features/localization/translations/${code}.ts`, { './en': {} })[code]
    for (const key of keys) {
      const value = key.split('.').reduce((node, part) => node?.[part], bundle)
      assert.equal(typeof value, 'string', `${code} is missing ${key}`)
      assert.ok(value.trim(), `${code} ${key} is empty`)
    }
  }
})

test('a failed generation shows why it failed, not a generic state', () => {
  assert.equal(
    generation.designGenerationStatusKey({ status: 'failed', errorCode: 'SOURCE_PHOTO_UNAVAILABLE' }),
    'designMySpace.visualize.errors.photoMissing'
  )
  assert.equal(
    generation.designGenerationStatusKey({ status: 'failed', errorCode: null }),
    'designMySpace.visualize.errors.generic'
  )
  assert.equal(generation.designGenerationStatusKey({ status: 'queued', errorCode: null }), 'designMySpace.visualize.status.queued')
})

test('queued and processing are the active states', () => {
  assert.equal(generation.isActiveGenerationStatus('queued'), true)
  assert.equal(generation.isActiveGenerationStatus('processing'), true)
  assert.equal(generation.isActiveGenerationStatus('failed'), false)
  assert.equal(generation.isActiveGenerationStatus('succeeded'), false)
})

/* ═══════════════ The screen ═══════════════ */

const SCREEN = 'src/app/design-room-photo.tsx'

test('the request action exists only when the site switch says so', () => {
  const screen = read(SCREEN)
  const loader = screen.slice(screen.indexOf('const loadVisualization'), screen.indexOf('const formatDate'))

  // The switch is the existing site setting, read from the API — not a second flag.
  assert.ok(screen.includes('settings.designGenerationsEnabled === true'))
  assert.ok(screen.includes("{boardId && visualizeState === 'enabled' ? ("), 'the action is not gated by the switch')

  // Reading the switch is its own step, and only that step decides on/off.
  const settingsStep = loader.slice(0, loader.indexOf('if (!enabled || !boardId) return;'))
  assert.ok(settingsStep.includes("enabled ? 'enabled' : 'disabled'"))
  // A switch that cannot be READ is not treated as "switched off".
  assert.ok(settingsStep.includes("setVisualizeState('unknown')"))

  // The history lookup must NOT be able to disable the feature: it only finds
  // an earlier request, and failing it still leaves a new one possible.
  const historyStep = loader.slice(loader.indexOf('if (!enabled || !boardId) return;'))
  assert.ok(historyStep.includes('fetchDesignGenerations'))
  assert.equal(/setVisualizeState\(/.test(historyStep), false, 'a failed history lookup can switch the feature off')

  // Creation happens in exactly one place, from a tap.
  assert.equal((screen.match(/createDesignGeneration\(/g) ?? []).length, 1)
})

test('when the switch is off the screen says so, rather than looking broken', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes("{boardId && visualizeState === 'disabled' ? ("))
  assert.ok(screen.includes("t('designMySpace.visualize.errors.unavailable')"))

  const en = load('src/features/localization/translations/en.ts', { './en': {} }).en.designMySpace.visualize
  assert.match(en.errors.unavailable, /not available/i)
})

test('a visualization is only shown when the server says a real image exists', () => {
  const screen = read(SCREEN)

  // The image is rendered behind the server's own flag, never on status alone.
  assert.ok(screen.includes('hasVisualizationImage(watched)'))
  assert.ok(screen.includes('designGenerationImageSource(owner.token, watched.id)'))
  // It comes from the API with the token — never a storage URL.
  assert.equal(/res\.cloudinary|signedUrl|publicId/.test(screen), false, 'the screen reaches for private storage')

  // The only status text comes from the backend status, through one mapper.
  assert.ok(screen.includes('t(designGenerationStatusKey(watched))'))

  const en = load('src/features/localization/translations/en.ts', { './en': {} }).en.designMySpace.visualize
  // While it is running, the wording promises nothing.
  assert.equal(/ready|complete|finished/i.test(en.status.queued), false, en.status.queued)
  assert.equal(/ready|complete|finished/i.test(en.status.processing), false, en.status.processing)
  // And the result is labelled a concept, not a construction plan.
  assert.match(en.conceptNote, /concept/i)
})

test('no fabricated progress is shown', () => {
  const screen = read(SCREEN)
  // The visualization block: from its heading to its error line.
  const block = screen.slice(
    screen.indexOf("t('designMySpace.visualize.heading')"),
    screen.indexOf('{generationError ? (')
  )
  assert.ok(block.length > 200, 'the visualization block was not found')
  // A spinner is honest; a percentage or a progress bar would not be, because
  // the provider reports no progress at all. (Prose may mention the word;
  // what must not exist is progress UI or a computed percentage.)
  const code = block.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
  assert.equal(/<Progress|progressBar|progress=\{|percent|Math\.round\([^)]*100/i.test(code), false,
    'the screen invents progress')
  assert.ok(block.includes('<ActivityIndicator'))
})

test('a failed request is reported, never shown as queued', () => {
  const screen = read(SCREEN)
  const request = screen.slice(screen.indexOf('const requestVisualization'), screen.indexOf('/* ── Remove'))
  const catchBlock = request.slice(request.indexOf('} catch (err) {'))
  assert.ok(catchBlock.includes('setGenerationError('))
  assert.equal(catchBlock.includes('setGeneration('), false, 'a failed request still set a generation')
})

test('visualization state belongs to the account-keyed component', () => {
  const screen = read(SCREEN)
  const flow = screen.slice(screen.indexOf('function RoomPhotoFlow'))
  for (const state of ['useState<DesignGeneration | null>(null)', 'useState(false)']) {
    assert.ok(flow.includes(state), `${state} is not owned by the keyed component`)
  }
  const route = screen.slice(screen.indexOf('export default function DesignRoomPhotoScreen'), screen.indexOf('type Stage'))
  assert.ok(route.includes('<RoomPhotoFlow key={access.owner.userId}'))
  assert.equal(/useState|createDesignGeneration/.test(route), false, 'the route holds state that would survive an account change')
})

/* ═══════════════ Polling ═══════════════ */

let polling

before(() => {
  polling = load('src/features/design-my-space/use-design-generation.ts', {
    react: { useCallback: () => {}, useEffect: () => {}, useRef: () => ({}), useState: () => [null, () => {}] },
    '@/features/design-my-space/design-generation': generation,
    '@/features/design-my-space/design-generation-api': api,
    '@/services/api-client': apiClient,
  })
})

test('the poll interval widens and then holds, so a slow job is not hammered', () => {
  const delays = [0, 1, 2, 3, 4, 5, 6, 50].map((attempt) => polling.nextGenerationPollDelay(attempt))

  // Never faster than a few seconds, never slower than the last step.
  assert.ok(delays.every((delay) => delay >= 4000 && delay <= 20000))
  // Non-decreasing, and it plateaus rather than growing forever.
  for (let i = 1; i < delays.length; i += 1) assert.ok(delays[i] >= delays[i - 1])
  assert.equal(delays.at(-1), delays.at(-2))
  // A negative attempt cannot produce a tight loop.
  assert.equal(polling.nextGenerationPollDelay(-5), delays[0])
})

test('polling runs only for unfinished work on a screen the user is looking at', () => {
  const active = { active: true, elapsedMs: 0 }

  assert.equal(polling.shouldPollGeneration({ status: 'queued' }, active), true)
  assert.equal(polling.shouldPollGeneration({ status: 'processing' }, active), true)

  // Finished: nothing more will change on its own.
  assert.equal(polling.shouldPollGeneration({ status: 'succeeded' }, active), false)
  assert.equal(polling.shouldPollGeneration({ status: 'failed' }, active), false)
  // Nothing to watch.
  assert.equal(polling.shouldPollGeneration(null, active), false)
  // Screen not in front of the user.
  assert.equal(polling.shouldPollGeneration({ status: 'queued' }, { active: false, elapsedMs: 0 }), false)
  // And it gives up rather than polling forever.
  assert.equal(polling.shouldPollGeneration({ status: 'queued' }, { active: true, elapsedMs: polling.GENERATION_POLL_TIMEOUT_MS }), false)
})

test('the watcher stops on a terminal status, on 404, and when unmounted', () => {
  const source = read('src/features/design-my-space/use-design-generation.ts')

  // Terminal: the loop returns instead of scheduling another check.
  assert.ok(source.includes('if (!isActiveGenerationStatus(next.status)) return;'))
  // Gone for this account: stop and say so.
  assert.ok(source.includes('error.status === 404'))
  assert.ok(source.includes('setGone(true)'))
  // Every scheduled check is cancelled on cleanup.
  assert.ok(source.includes('cancelled = true'))
  assert.ok(source.includes('clearTimeout(timer)'))
  // Timeout leaves an explicit state rather than silently stopping.
  assert.ok(source.includes('setTimedOut(true)'))
  // No interval that could outlive the screen.
  assert.equal(/setInterval/.test(source), false, 'polling uses an interval that can leak')
})

test('the screen polls only while focused, and stops when it is left', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes('useFocusEffect('))
  assert.ok(screen.includes('setFocused(true)'))
  assert.ok(screen.includes('return () => setFocused(false)'))
  assert.ok(screen.includes('useDesignGeneration({ token: owner.token, generation, active: focused })'))
})
