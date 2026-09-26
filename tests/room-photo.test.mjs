// Room photos in the app: the contract with the backend, the upload path, the
// picker, and the screen's privacy and consent guarantees.
//
// Runs the real modules — including the real apiRequest/apiUpload — against a
// fake `fetch`, a recording FormData, and stand-ins for the native picker and
// manipulator.

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

/* ── Recording FormData and fake fetch ─────────────────────────────────── */

class RecordingFormData {
  constructor() { this.entries = [] }
  append(name, value) { this.entries.push([name, value]) }
}
globalThis.FormData = RecordingFormData

const API = 'https://api.test/api'
const requests = []
let respond = null

globalThis.fetch = async (url, init = {}) => {
  requests.push({ url, init })
  return respond(url, init)
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

/* ── Native stand-ins ──────────────────────────────────────────────────── */

const native = { calls: [], cameraGranted: true, libraryGranted: true, result: null }

const imagePicker = {
  requestCameraPermissionsAsync: async () => { native.calls.push('requestCamera'); return { granted: native.cameraGranted } },
  requestMediaLibraryPermissionsAsync: async () => { native.calls.push('requestLibrary'); return { granted: native.libraryGranted } },
  launchCameraAsync: async (options) => { native.calls.push(['launchCamera', options]); return native.result },
  launchImageLibraryAsync: async (options) => { native.calls.push(['launchLibrary', options]); return native.result },
}

const imageManipulator = {
  SaveFormat: { JPEG: 'jpeg', PNG: 'png', WEBP: 'webp' },
  ImageManipulator: {
    manipulate: (uri) => {
      native.calls.push(['manipulate', uri])
      let size = null
      const context = {
        resize: (target) => { size = target; native.calls.push(['resize', target]); return context },
        renderAsync: async () => ({
          saveAsync: async (options) => {
            native.calls.push(['save', options])
            return { uri: 'file:///cache/prepared.jpg', width: size?.width ?? 1500, height: size?.height ?? 1125 }
          },
        }),
      }
      return context
    },
  },
}

/* ── Modules ───────────────────────────────────────────────────────────── */

let roomPhoto
let api
let picker
let apiClient
let account

before(() => {
  process.env.EXPO_PUBLIC_API_URL = API
  const config = load('src/constants/config.ts')
  apiClient = load('src/services/api-client.ts', { '@/constants/config': config })
  const apiUpload = load('src/services/api-upload.ts', { '@/constants/config': config, '@/services/api-client': apiClient })
  roomPhoto = load('src/features/design-my-space/room-photo.ts')
  api = load('src/features/design-my-space/room-photo-api.ts', {
    '@/constants/config': config,
    '@/features/design-my-space/room-photo': roomPhoto,
    '@/services/api-client': apiClient,
    '@/services/api-upload': apiUpload,
  })
  picker = load('src/features/design-my-space/room-photo-picker.ts', {
    'expo-image-picker': imagePicker,
    'expo-image-manipulator': imageManipulator,
    '@/features/design-my-space/room-photo': roomPhoto,
  })
  account = load('src/features/account/account-api.ts', {
    '@/services/api-client': apiClient,
    '@/services/api-upload': apiUpload,
  })
})

beforeEach(() => {
  requests.length = 0
  respond = null
  native.calls.length = 0
  native.cameraGranted = true
  native.libraryGranted = true
  native.result = null
})

const ID = '64b7f0c2a1b2c3d4e5f60718'
const serverPhoto = (overrides = {}) => ({
  _id: ID, status: 'ready', width: 2048, height: 1536, format: 'jpg',
  createdAt: '2026-09-17T10:00:00.000Z', expiresAt: '2026-10-17T10:00:00.000Z', ...overrides,
})
const file = { uri: 'file:///cache/prepared.jpg', name: 'room-photo.jpg', type: 'image/jpeg' }

/* ═══════════════ The contract ═══════════════ */

const BACKEND_CONFIG = path.resolve(ROOT, '..', 'varlikent', 'backend', 'config', 'designRoomPhotos.js')

test('the app and the backend require the same consent version and retention', { skip: !fs.existsSync(BACKEND_CONFIG) && 'backend not checked out beside the app' }, async () => {
  const backend = await import(`file://${BACKEND_CONFIG.replace(/\\/g, '/')}`)
  assert.equal(roomPhoto.ROOM_PHOTO_CONSENT_VERSION, backend.ROOM_PHOTO_CONSENT_VERSION)
  assert.equal(roomPhoto.ROOM_PHOTO_UPLOAD_LONG_EDGE, backend.ROOM_PHOTO_MAX_LONG_EDGE)

  // The consent text states the retention period; it must be the real one.
  for (const code of ['en', 'tr', 'ar', 'de', 'ru', 'ur']) {
    const bundle = load(`src/features/localization/translations/${code}.ts`, { './en': {} })[code]
    assert.ok(bundle.designMySpace.roomPhoto.consentBody.includes(String(backend.ROOM_PHOTO_RETENTION_DAYS)), `${code} consent does not state the retention period`)
  }
})

test('a server photo keeps only safe fields, and anything not ready is refused', () => {
  const photo = roomPhoto.roomPhotoFromServer(serverPhoto({ publicId: 'varlikent/x', url: 'https://res.cloudinary.com/x', asset: {} }))
  assert.deepEqual(photo, { id: ID, width: 2048, height: 1536, createdAt: '2026-09-17T10:00:00.000Z', expiresAt: '2026-10-17T10:00:00.000Z' })

  for (const broken of [{ status: 'uploading' }, { status: 'deleted' }, { _id: 'x' }, { width: 0 }, { height: 1.5 }, { createdAt: 'yesterday' }]) {
    assert.equal(roomPhoto.roomPhotoFromServer(serverPhoto(broken)), null, JSON.stringify(broken))
  }
  assert.equal(roomPhoto.roomPhotoFromServer(null), null)
})

test('the upload copy is only ever shrunk, never enlarged', () => {
  assert.deepEqual(roomPhoto.roomPhotoResizeTarget(4032, 3024), { width: 2048 })
  assert.deepEqual(roomPhoto.roomPhotoResizeTarget(3024, 4032), { height: 2048 })
  assert.equal(roomPhoto.roomPhotoResizeTarget(1600, 1200), null)
  assert.equal(roomPhoto.roomPhotoResizeTarget(0, 0), null)
})

test('every backend error code maps to a message that exists in all six languages', () => {
  const codes = ['PHOTO_UNREADABLE', 'PHOTO_UNSUPPORTED_FORMAT', 'PHOTO_DIMENSIONS_TOO_LARGE', 'PHOTO_FILE_TOO_LARGE', 'PHOTO_TOO_SMALL', 'PHOTO_ASPECT_RATIO', 'CONSENT_REQUIRED', 'ROOM_PHOTO_LIMIT_REACHED', 'ROOM_PHOTO_DAILY_LIMIT', 'ROOM_PHOTO_BUSY']
  const keys = [
    ...codes.map((code) => roomPhoto.roomPhotoErrorKey({ code })),
    roomPhoto.roomPhotoErrorKey({ kind: 'network' }),
    roomPhoto.roomPhotoErrorKey({ kind: 'auth' }),
    roomPhoto.roomPhotoErrorKey({ code: 'SOMETHING_NEW', kind: 'server' }),
    roomPhoto.roomPhotoErrorKey(null),
  ]
  assert.equal(roomPhoto.roomPhotoErrorKey({ code: 'SOMETHING_NEW' }), 'designMySpace.roomPhoto.errors.generic')

  for (const code of ['en', 'tr', 'ar', 'de', 'ru', 'ur']) {
    const bundle = load(`src/features/localization/translations/${code}.ts`, { './en': {} })[code]
    for (const key of keys) {
      const value = key.split('.').reduce((node, part) => node?.[part], bundle)
      assert.equal(typeof value, 'string', `${code} is missing ${key}`)
    }
  }
})

/* ═══════════════ Upload ═══════════════ */

test('an upload sends consent FIRST, then the photo, with the Bearer token and no hand-set Content-Type', async () => {
  respond = () => json(201, { success: true, photo: serverPhoto() })
  const photo = await api.uploadRoomPhoto('token-a', file)

  assert.equal(photo.id, ID)
  const [{ url, init }] = requests
  assert.equal(url, `${API}/design-room-photos`)
  assert.equal(init.method, 'POST')
  assert.equal(init.headers.Authorization, 'Bearer token-a')
  assert.equal('Content-Type' in init.headers, false, 'a manual Content-Type breaks the multipart boundary')
  assert.deepEqual(init.body.entries, [
    ['consentVersion', roomPhoto.ROOM_PHOTO_CONSENT_VERSION],
    ['photo', file],
  ])
})

test('a server rejection is an ApiError carrying the backend code — never a success', async () => {
  respond = () => json(400, { success: false, code: 'PHOTO_TOO_SMALL', message: 'This photo is too small to use for a room.' })
  await assert.rejects(api.uploadRoomPhoto('token-a', file), (err) => {
    assert.ok(err instanceof apiClient.ApiError)
    assert.equal(err.code, 'PHOTO_TOO_SMALL')
    assert.equal(err.status, 400)
    return true
  })

  respond = () => json(413, { success: false, code: 'PHOTO_FILE_TOO_LARGE' })
  await assert.rejects(api.uploadRoomPhoto('token-a', file), (err) => err.code === 'PHOTO_FILE_TOO_LARGE')

  // A proxy error page is not JSON; it still fails cleanly.
  respond = () => new Response('<html>502</html>', { status: 502 })
  await assert.rejects(api.uploadRoomPhoto('token-a', file), (err) => err.kind === 'server')

  // A 201 whose body is unusable is not treated as a stored photo.
  respond = () => json(201, { success: true, photo: serverPhoto({ status: 'uploading' }) })
  await assert.rejects(api.uploadRoomPhoto('token-a', file), apiClient.ApiError)
})

test('an unreachable server is a network error', async () => {
  respond = () => { throw new TypeError('Network request failed') }
  await assert.rejects(api.uploadRoomPhoto('token-a', file), (err) => err.kind === 'network')
})

test('list, read and delete are authenticated and scoped by id only', async () => {
  respond = (url, init) => {
    if (init.method === 'DELETE') return json(200, { success: true })
    if (url.endsWith('/design-room-photos')) return json(200, { success: true, photos: [serverPhoto(), serverPhoto({ _id: 'bad' })] })
    return json(200, { success: true, photo: serverPhoto() })
  }

  const list = await api.fetchRoomPhotos('token-a')
  assert.deepEqual(list.map((p) => p.id), [ID], 'an unreadable entry was kept')
  assert.equal((await api.fetchRoomPhoto('token-a', ID)).id, ID)
  await api.deleteRoomPhoto('token-a', ID)

  assert.deepEqual(requests.map((r) => [r.init.method ?? 'GET', r.url.replace(API, ''), r.init.headers.Authorization]), [
    ['GET', '/design-room-photos', 'Bearer token-a'],
    ['GET', `/design-room-photos/${ID}`, 'Bearer token-a'],
    ['DELETE', `/design-room-photos/${ID}`, 'Bearer token-a'],
  ])
})

test('a stored photo is displayed from the authenticated API, never from a storage URL', () => {
  const source = api.roomPhotoImageSource('token-a', ID)
  assert.deepEqual(source, { uri: `${API}/design-room-photos/${ID}/image`, headers: { Authorization: 'Bearer token-a' } })
})

test('the avatar upload still uses its own endpoint and field, through the shared upload path', async () => {
  respond = () => json(200, { success: true, user: { _id: 'u1', avatar: 'https://example.test/a.jpg' } })
  const user = await account.uploadAvatar('token-a', { uri: 'file:///a.jpg', name: 'avatar.jpg', type: 'image/jpeg' })

  assert.equal(user._id, 'u1')
  const [{ url, init }] = requests
  assert.equal(url, `${API}/users/me/avatar`)
  assert.equal(init.method, 'PUT')
  assert.equal(init.headers.Authorization, 'Bearer token-a')
  assert.deepEqual(init.body.entries.map(([name]) => name), ['avatar'])

  respond = () => json(400, { success: false, message: 'No image provided' })
  await assert.rejects(account.uploadAvatar('token-a', { uri: 'x', name: 'x', type: 'image/jpeg' }), (err) => err.message === 'No image provided' && err.kind === 'validation')
})

/* ═══════════════ Picker ═══════════════ */

test('loading the picker module asks for no permission', () => {
  assert.deepEqual(native.calls, [])
})

test('Take Photo asks for camera permission at that moment, then opens the camera uncropped and without EXIF', async () => {
  native.result = { canceled: false, assets: [{ uri: 'file:///camera.heic', width: 4032, height: 3024 }] }
  const outcome = await picker.takeRoomPhoto()

  assert.equal(native.calls[0], 'requestCamera')
  const [, options] = native.calls[1]
  assert.equal(native.calls[1][0], 'launchCamera')
  assert.equal(options.allowsEditing, false, 'a room photo must not be square-cropped')
  assert.equal(options.exif, false)
  assert.deepEqual(options.mediaTypes, ['images'])

  // Prepared as a resized JPEG with a neutral name.
  assert.deepEqual(native.calls.find((c) => c[0] === 'resize'), ['resize', { width: 2048 }])
  assert.deepEqual(native.calls.find((c) => c[0] === 'save')[1], { format: 'jpeg', compress: roomPhoto.ROOM_PHOTO_UPLOAD_COMPRESS })
  assert.deepEqual(outcome, { type: 'picked', photo: { uri: 'file:///cache/prepared.jpg', name: 'room-photo.jpg', type: 'image/jpeg', width: 2048, height: 1125 } })
})

test('Choose From Gallery asks for library permission only', async () => {
  native.result = { canceled: false, assets: [{ uri: 'file:///library.jpg', width: 1600, height: 1200 }] }
  await picker.chooseRoomPhoto()
  assert.equal(native.calls[0], 'requestLibrary')
  assert.equal(native.calls[1][0], 'launchLibrary')
  assert.equal(native.calls.includes('requestCamera'), false)
  assert.equal(native.calls.some((c) => c[0] === 'resize'), false, 'a small photo was resized')
})

test('a denied permission never opens the camera or gallery', async () => {
  native.cameraGranted = false
  assert.deepEqual(await picker.takeRoomPhoto(), { type: 'permission-denied' })
  native.libraryGranted = false
  assert.deepEqual(await picker.chooseRoomPhoto(), { type: 'permission-denied' })
  assert.deepEqual(native.calls, ['requestCamera', 'requestLibrary'])
})

test('backing out of the picker is a cancellation, not an error', async () => {
  native.result = { canceled: true, assets: null }
  assert.deepEqual(await picker.chooseRoomPhoto(), { type: 'cancelled' })
})

/* ═══════════════ The screen ═══════════════ */

const SCREEN = 'src/app/design-room-photo.tsx'

test('the room-photo screen is signed-in only, keyed by account, with the shared gate', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes('designMySpaceAccess(status, userId, token)'))
  assert.ok(screen.includes('<RoomPhotoFlow key={access.owner.userId}'))
  assert.ok(screen.includes("<DesignMySpaceGate restoring={access.state === 'restoring'} onBack={leave} />"))
  assert.equal((screen.match(/<RoomPhotoFlow\b/g) ?? []).length, 1)
})

test('nothing is uploaded without consent, and each new photo needs fresh consent', () => {
  const screen = read(SCREEN)
  const upload = screen.slice(screen.indexOf('const upload = async'), screen.indexOf('/* ── Remove'))
  assert.ok(upload.includes("if (stage.name !== 'preview' || !consented) return;"))
  assert.ok(screen.includes("disabled={!consented || stage.name === 'uploading'}"))
  assert.ok(screen.includes('accessibilityRole="checkbox"'))
  const pick = screen.slice(screen.indexOf('const pick = async'), screen.indexOf('const upload = async'))
  assert.ok(pick.includes('setConsented(false)'))
  // uploadRoomPhoto is called in exactly one place.
  assert.equal((screen.match(/uploadRoomPhoto\(/g) ?? []).length, 1)
})

test('a failed upload returns to the preview with an error; only a stored photo reaches "ready"', () => {
  const screen = read(SCREEN)
  const upload = screen.slice(screen.indexOf('const upload = async'), screen.indexOf('/* ── Remove'))
  const catchBlock = upload.slice(upload.indexOf('} catch (err) {'))
  assert.ok(catchBlock.includes("setStage({ name: 'preview', photo })"))
  assert.equal(catchBlock.includes("name: 'ready'"), false)
  assert.ok(upload.indexOf('await uploadRoomPhoto') < upload.indexOf("setStage({ name: 'ready', photo: stored })"))
})

test('permissions are requested only through the picker, on tap', () => {
  const screen = read(SCREEN)
  assert.equal(/requestCameraPermissionsAsync|requestMediaLibraryPermissionsAsync|launchCameraAsync|launchImageLibraryAsync/.test(screen), false)
  const effects = screen.match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\);/g) ?? []
  for (const effect of effects) assert.equal(/takeRoomPhoto|chooseRoomPhoto/.test(effect), false, 'a picker runs from an effect')
})

test('private photos are shown through the authenticated source and never cached by expo-image', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes('roomPhotoImageSource(owner.token, stage.photo.id)'))
  // The local preview, the stored room photo, and (now that visualizations
  // exist) the before/after image. Every one of them is private.
  const images = screen.match(/<Image\b[\s\S]*?\/>/g) ?? []
  assert.equal(images.length, 3)
  for (const image of images) assert.ok(image.includes('cachePolicy="none"'), 'an image may be cached on the device')
  assert.equal(/AsyncStorage|SecureStore|res\.cloudinary|publicId/.test(screen), false, 'room photo state is persisted or a storage URL is used')
})

test('the board is navigation context only — it is never sent with the photo', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes('isServerDesignBoardId(params.boardId)'))
  assert.ok(screen.includes('uploadRoomPhoto(owner.token, photo)'))
  const apiSource = read('src/features/design-my-space/room-photo-api.ts')
  assert.equal(/board/i.test(apiSource.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), false, 'the API layer sends board data')
})

test('"ready" never claims a redesign exists', () => {
  const en = load('src/features/localization/translations/en.ts', { './en': {} }).en.designMySpace.roomPhoto
  assert.match(en.readyBody, /No redesign has been created yet/)
  for (const text of [en.readyHeading, en.readyBody, en.consentBody]) {
    assert.equal(/generated|your redesign is|AI result/i.test(text), false, text)
  }
})
