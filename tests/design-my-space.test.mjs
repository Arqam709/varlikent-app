// Design My Space: the vocabularies, the contact handoff, and the screen.
//
// Three things are pinned here:
//
//   1. The stable ids. Rooms, styles and lighting are app-owned vocabularies
//      saved into boards, so renaming an id silently invalidates saved work.
//      Styles must also keep the WEBSITE's ids, so showroom imagery can be
//      attached later with no migration.
//   2. The handoff. A board becomes a message on the enquiry form the app
//      already has — the same stable contact interest the service page sends,
//      with no new endpoint and no new interest.
//   3. The screen's guarantees: six steps, no AI or camera anywhere near this
//      feature, an entry point only on Interior Design, no palette request
//      from Home — and nothing at all for a visitor who is not signed in.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const load = (relative, imports = {}) => {
  const { outputText } = ts.transpileModule(read(relative), {
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

const LANGS = ['en', 'tr', 'ar', 'de', 'ru', 'ur']
const SCREEN = 'src/app/design-my-space.tsx'

let options
let db
let serializer
let services
const bundles = {}

before(() => {
  const remoteImage = load('src/utils/remote-image.ts')
  const sp = load('src/features/studio-palette/studio-palette.ts', { '@/utils/remote-image': remoteImage })

  options = load('src/features/design-my-space/design-options.ts')
  db = load('src/features/design-my-space/design-board.ts', {
    '@/features/design-my-space/design-options': options,
    '@/features/studio-palette/studio-palette': sp,
    '@/utils/remote-image': remoteImage,
  })
  serializer = load('src/features/design-my-space/design-board-serializer.ts', {
    '@/features/design-my-space/design-options': options,
    '@/features/design-my-space/design-board': db,
  })
  services = load('src/features/services/services-data.ts')

  for (const code of LANGS) {
    bundles[code] = load(`src/features/localization/translations/${code}.ts`, { './en': {} })[code]
  }
})

const at = (bundle, key) => key.split('.').reduce((node, part) => node?.[part], bundle)

/** The app's own interpolation, so serialized text is what a user would see. */
const translate = (code) => (key, values = {}) => {
  const value = at(bundles[code], key)
  assert.equal(typeof value, 'string', `${code} is missing ${key}`)
  return value.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match))
}

/* ═══════════════ 1. The vocabularies ═══════════════ */

test('1. the stable ids are exactly these', () => {
  // Spelled out rather than derived: changing one is a deliberate edit here,
  // and every saved board on every device already carries the old value.
  assert.deepEqual([...options.ROOM_IDS], ['living-room', 'bedroom', 'kitchen', 'bathroom', 'office'])
  assert.deepEqual([...options.STYLE_IDS], ['contemporary', 'warm', 'coastal', 'classic'])
  assert.deepEqual([...options.LIGHTING_IDS], ['day', 'warm', 'cool', 'night'])
  assert.deepEqual([...options.DESIGN_STEPS], ['room', 'style', 'wall', 'floor', 'materials', 'lighting'])
})

test('2. the style ids are the website’s, so showroom imagery can attach later', () => {
  // Admin → Showroom offers exactly these on its Interior tab. There are zero
  // interior showroom items today, which is why this MVP shows no imagery —
  // but the ids must already agree for that to become possible without a
  // migration.
  assert.deepEqual([...options.STYLE_IDS], ['contemporary', 'warm', 'coastal', 'classic'])
})

test('3. every option is listed once, with an icon and translation keys', () => {
  const groups = [
    [options.DESIGN_ROOMS, options.ROOM_IDS],
    [options.DESIGN_STYLES, options.STYLE_IDS],
    [options.DESIGN_LIGHTING, options.LIGHTING_IDS],
  ]

  for (const [list, ids] of groups) {
    assert.deepEqual(list.map((option) => option.id), [...ids])
    for (const option of list) {
      assert.ok(option.icon, `${option.id} has no icon`)
      assert.match(option.labelKey, /^designMySpace\./)
      assert.match(option.descriptionKey, /^designMySpace\./)
    }
  }
})

test('4. the guards accept only real ids', () => {
  assert.equal(options.isRoomId('living-room'), true)
  assert.equal(options.isStyleId('warm'), true)
  assert.equal(options.isLightingMoodId('night'), true)

  for (const value of ['Living Room', 'livingRoom', 'attic', '', null, undefined, 7, {}]) {
    assert.equal(options.isRoomId(value), false, String(value))
    assert.equal(options.isStyleId(value), false, String(value))
    assert.equal(options.isLightingMoodId(value), false, String(value))
  }
})

/* ═══════════════ 5. Localization ═══════════════ */

test('5. every Design My Space key exists in all six bundles, with the same shape', () => {
  const english = at(bundles.en, 'designMySpace')
  assert.ok(english, 'en has no designMySpace block')

  const shape = (node, prefix = '') =>
    Object.entries(node).flatMap(([key, value]) =>
      typeof value === 'string' ? [`${prefix}${key}`] : shape(value, `${prefix}${key}.`)
    )

  const expected = shape(english).sort()

  for (const code of LANGS) {
    const block = at(bundles[code], 'designMySpace')
    assert.ok(block, `${code} has no designMySpace block`)
    assert.deepEqual(shape(block).sort(), expected, `${code} does not match the English key structure`)

    for (const key of expected) {
      const value = at(block, key)
      assert.ok(value.trim(), `${code} designMySpace.${key} is empty`)
    }
  }
})

test('6. every option label and hint resolves in all six languages', () => {
  const keys = [...options.DESIGN_ROOMS, ...options.DESIGN_STYLES, ...options.DESIGN_LIGHTING]
    .flatMap((option) => [option.labelKey, option.descriptionKey])

  for (const code of LANGS) {
    for (const key of keys) {
      const value = at(bundles[code], key)
      assert.equal(typeof value, 'string', `${code} is missing ${key}`)
      assert.ok(value.trim(), `${code} ${key} is empty`)
    }
  }
})

test('7. the placeholders survive translation', () => {
  const placeholders = {
    'designMySpace.stepProgress': ['{current}', '{total}'],
    'designMySpace.deleteBody': ['{name}'],
    'designMySpace.openA11y': ['{name}'],
    'designMySpace.deleteA11y': ['{name}'],
    'designMySpace.materialImageA11y': ['{name}'],
  }

  for (const code of LANGS) {
    for (const [key, marks] of Object.entries(placeholders)) {
      const value = at(bundles[code], key)
      for (const mark of marks) assert.ok(value.includes(mark), `${code} ${key} lost ${mark}`)
    }
  }
})

test('8. no palette name is bundled as translated copy', () => {
  // Wall, floor and material names are runtime Studio Palette data. If any of
  // them appears in a translation bundle, an owner's palette change would no
  // longer reach the app.
  const flatten = (node, out = []) => {
    for (const value of Object.values(node)) typeof value === 'string' ? out.push(value) : flatten(value, out)
    return out
  }

  const paletteNames = ['Warm Sand', 'Dark Oak', 'Calacatta Marble', 'Aged Brass', 'Slate Blue', 'Light Ash', 'Nero Stone', 'Midnight Navy']

  for (const code of LANGS) {
    const strings = flatten(at(bundles[code], 'designMySpace'))
    for (const name of paletteNames) {
      assert.equal(strings.includes(name), false, `${code} bundles the palette name "${name}"`)
    }
  }
})

/* ═══════════════ 9. The contact handoff ═══════════════ */

const sampleBoard = () =>
  db.boardFromDraft(
    {
      room: 'living-room',
      style: 'warm',
      wall: { label: 'Warm Sand', color: '#e8ddd0' },
      floor: { label: 'Dark Oak', color: '#4a3728' },
      materials: [
        { name: 'Calacatta Marble', color: '#f2ede8' },
        { name: 'Aged Brass', color: '#C9A35A' },
      ],
      lighting: 'warm',
    },
    { id: 'dms-message', now: '2026-09-16T10:00:00.000Z' }
  )

test('9. the serialized board carries every part of the brief, on one line', () => {
  const message = serializer.serializeDesignBoard(sampleBoard(), translate('en'))

  assert.equal(
    message,
    'Design Board · Room: Living Room · Style: Warm Modern · Wall: Warm Sand (#e8ddd0) · ' +
      'Floor: Dark Oak (#4a3728) · Materials: Calacatta Marble, Aged Brass · Lighting: Warm Evening'
  )

  // The admin inbox and the lead email both collapse newlines, so the message
  // must not rely on them.
  assert.equal(/[\r\n]/.test(message), false)
})

test('10. it serializes in the user’s language, with the palette’s own names', () => {
  for (const code of LANGS) {
    const message = serializer.serializeDesignBoard(sampleBoard(), translate(code))

    assert.ok(message.includes(at(bundles[code], 'designMySpace.rooms.livingRoom')), `${code} room`)
    assert.ok(message.includes(at(bundles[code], 'designMySpace.lighting.warm')), `${code} lighting`)
    // Studio Palette has no translations; the names stay as the admin saved them.
    assert.ok(message.includes('Warm Sand'), `${code} wall name`)
    assert.ok(message.includes('#4a3728'), `${code} floor colour`)
  }
})

test('11. choosing no materials says so, rather than leaving a blank', () => {
  const board = { ...sampleBoard(), materials: [] }
  const message = serializer.serializeDesignBoard(board, translate('en'))

  assert.ok(message.includes('Materials: No materials chosen'))
  assert.equal(/Materials:\s*·/.test(message), false, 'an empty value was rendered')
  assert.equal(message.includes('undefined'), false)
})

test('12. the route sends the stable interest id and the board, nothing else', () => {
  const route = serializer.designConsultationRoute(sampleBoard(), translate('en'))

  assert.equal(route.pathname, '/contact')
  assert.deepEqual(Object.keys(route.params).sort(), ['interestType', 'message'])
  assert.equal(route.params.interestType, 'interior_design')

  // Never a display label, never a palette value.
  assert.notEqual(route.params.interestType, 'Interior Design')
  assert.equal(route.params.interestType.includes('#'), false)

  for (const part of ['Room:', 'Style:', 'Wall:', 'Floor:', 'Materials:', 'Lighting:']) {
    assert.ok(route.params.message.includes(part), `the message has no ${part}`)
  }
})

test('13. the interest is the SAME one the Interior Design page already sends', () => {
  const service = services.getService('interior-design')
  assert.equal(serializer.DESIGN_CONSULTATION_INTEREST, service.contactInterestId)
})

test('14. the Contact screen seeds the message once and never overwrites typing', () => {
  const screen = read('src/app/contact.tsx')

  assert.ok(screen.includes('requestedContactMessage(messageParam)'), 'the prefill is not read')
  assert.ok(/useState\(\(\) => requestedContactMessage\(messageParam\)\)/.test(screen),
    'the message must be seeded by a lazy initializer, not assigned on every render')
  assert.equal(/useEffect\([^)]*setMessage\(/s.test(screen), false,
    'an effect setting the message would overwrite what the user typed')

  // Ordinary Contact navigation is unchanged.
  assert.ok(screen.includes('requestedContactInterestKey(interestTypeParam)'))
  assert.ok(screen.includes('interestType: selectedInterest.value'))
})

test('15. the prefill is treated as untrusted route input', () => {
  const prefill = load('src/features/contact/contact-prefill.ts')

  assert.equal(prefill.requestedContactMessage(undefined), '')
  assert.equal(prefill.requestedContactMessage(['a', 'b']), '')
  assert.equal(prefill.requestedContactMessage(42), '')
  assert.equal(prefill.requestedContactMessage('  hello  '), 'hello')
  assert.equal(prefill.requestedContactMessage('x'.repeat(5000)).length, prefill.CONTACT_MESSAGE_PREFILL_LIMIT)
})

/* ═══════════════ 16. The screen ═══════════════ */

test('16. all six steps are rendered by the one screen', () => {
  const screen = read(SCREEN)
  for (const step of options.DESIGN_STEPS) {
    assert.ok(screen.includes(`case '${step}':`), `the screen does not render the ${step} step`)
  }
  // One route for the six steps, not six — plus the separate room-photo step.
  assert.deepEqual(
    fs.readdirSync(path.join(ROOT, 'src/app')).filter((name) => name.startsWith('design')),
    ['design-my-space.tsx', 'design-room-photo.tsx']
  )
})

test('17. a required step cannot be skipped, and the board is built only when complete', () => {
  const screen = read(SCREEN)

  assert.ok(screen.includes('disabled={!isStepComplete(draft, step)}'), 'Next is not gated on the step')
  assert.ok(screen.includes('boardFromDraft(draft'), 'the summary does not come from a validated board')
  assert.ok(screen.includes("{screen === 'board' && board ?"), 'the board view can render without a board')
  assert.ok(screen.includes('if (!board) return'), 'saving or sending is not gated on a complete board')
})

test('18. the entry point exists only on Interior Design', () => {
  const service = read('src/app/services/[service].tsx')

  assert.ok(service.includes("service.feature === 'design-my-space'"), 'the service page does not offer the tool')
  assert.ok(service.includes('DesignMySpaceEntry'))

  // Declared as data, on exactly one service.
  const data = read('src/features/services/services-data.ts')
  assert.equal((data.match(/feature: 'design-my-space'/g) ?? []).length, 1)
  assert.equal(services.SERVICES.filter((s) => s.feature === 'design-my-space').map((s) => s.id).join(), 'interior-design')

  // And nowhere else in the app.
  const offered = ['src/app/(tabs)/index.tsx', 'src/app/services/index.tsx', 'src/components/home/home-services-preview.tsx']
  for (const file of offered) {
    assert.equal(read(file).includes('design-my-space'), false, `${file} also offers Design My Space`)
  }
})

test('19. Home never requests the palette', () => {
  for (const file of ['src/app/(tabs)/index.tsx', 'src/components/home/home-services-preview.tsx', 'src/app/services/index.tsx']) {
    assert.equal(/useStudioPalette|refreshStudioPalette|fetchStudioPalette/.test(read(file)), false,
      `${file} loads the studio palette`)
  }
})

test('20. no AI provider or AR anywhere; the camera only where a room photo is taken', () => {
  const ROOM_PHOTO_SCREEN = 'src/app/design-room-photo.tsx'
  const PICKER = 'src/features/design-my-space/room-photo-picker.ts'
  const files = [
    SCREEN,
    ROOM_PHOTO_SCREEN,
    'src/features/contact/contact-prefill.ts',
    ...fs.readdirSync(path.join(ROOT, 'src/features/design-my-space')).filter((f) => f.endsWith('.ts')).map((f) => `src/features/design-my-space/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'src/features/design-my-space/components')).map((f) => `src/features/design-my-space/components/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'src/features/studio-palette')).map((f) => `src/features/studio-palette/${f}`),
  ]

  // The app may REQUEST a visualization (it sends two ids and a retry key), but
  // no provider is integrated and no generated image is handled anywhere:
  // producing one is entirely the backend's job, and none exists yet.
  const deferred = /openai|gemini|anthropic|stability|replicate|generateImage|ARKit|LiDAR/i
  // A generated image would be fetched from a result endpoint. There is none.
  // A generated image is now real, and is fetched from the API with the
  // user's token. What must never appear is a private storage URL or id.
  const storageUrl = /res\.cloudinary|signedUrl|sign_url|publicId/
  // Room photos never go through the public admin media endpoint.
  const adminUpload = /['"`]\/upload['"`]/
  const picker = /expo-image-picker|expo-camera|launchCamera|launchImageLibraryAsync|ImagePicker|expo-image-manipulator/

  for (const file of files) {
    const source = read(file)
    assert.equal(deferred.test(source), false, `${file} reaches for a deferred capability`)
    assert.equal(storageUrl.test(source), false, `${file} handles a private storage URL`)
    assert.equal(adminUpload.test(source), false, `${file} uses the public /upload endpoint`)
    // The picker and manipulator live in exactly one module.
    if (file !== PICKER) assert.equal(picker.test(source), false, `${file} uses the camera or picker directly`)
    // No dead "coming soon" controls either.
    assert.equal(/Generate With AI|Scan Room|Coming Soon/i.test(source), false, `${file} has a placeholder control`)
  }
})

test('21. the screen follows theme and reading direction, with no hardcoded colour', () => {
  const files = [
    SCREEN,
    ...fs.readdirSync(path.join(ROOT, 'src/features/design-my-space/components')).map((f) => `src/features/design-my-space/components/${f}`),
  ]

  for (const file of files) {
    const source = read(file)
    assert.ok(source.includes('useThemedStyles(makeStyles)'), `${file} does not use the theme`)
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(source), false, `${file} hardcodes a colour`)
  }

  const screen = read(SCREEN)
  assert.ok(screen.includes('useDirection()'), 'the screen ignores reading direction')

  // Every row that can carry a swatch beside a label follows reading order.
  for (const file of ['design-swatch-choice.tsx', 'design-material-choice.tsx', 'design-choice-card.tsx', 'design-saved-board-card.tsx', 'design-board-summary.tsx', 'design-step-progress.tsx']) {
    const source = read(`src/features/design-my-space/components/${file}`)
    assert.ok(source.includes('useDirection()'), `${file} ignores reading direction`)
    assert.ok(/flexDirection: row|textAlign/.test(source), `${file} does not mirror`)
    assert.equal(/language === '(ar|ur)'/.test(source), false, `${file} checks language instead of direction`)
  }
})

test('22. selection is announced, never carried by colour alone', () => {
  const swatch = read('src/features/design-my-space/components/design-swatch-choice.tsx')
  const material = read('src/features/design-my-space/components/design-material-choice.tsx')

  // A finish always renders its own name beside the colour.
  assert.ok(swatch.includes('{label}'), 'a wall option is only a coloured circle')
  assert.ok(swatch.includes('accessibilityLabel={label}'))
  assert.ok(swatch.includes('accessibilityState={{ selected, checked: selected }}'))
  assert.ok(swatch.includes("accessibilityRole=\"radio\""))

  // Materials are multi-select, and say so.
  assert.ok(material.includes("accessibilityRole=\"checkbox\""))
  assert.ok(material.includes('accessibilityState={{ checked: selected, selected }}'))
  assert.ok(material.includes('{name}'), 'a material is only a swatch')

  const progress = read('src/features/design-my-space/components/design-step-progress.tsx')
  assert.ok(progress.includes('accessibilityRole="progressbar"'))
  assert.ok(progress.includes('accessibilityValue='), 'progress is only visual')
})

/* ═══════════════ 5. Signed in only ═══════════════ */

const GATE = 'src/features/design-my-space/components/design-my-space-gate.tsx'

/** The source of one top-level function in the screen, up to the next one. */
const screenFunction = (screen, name) => {
  const start = screen.indexOf(`function ${name}(`)
  assert.ok(start >= 0, `the screen has no ${name}`)
  const next = screen.indexOf('\nfunction ', start + 1)
  return screen.slice(start, next < 0 ? undefined : next)
}

test('23. a visitor who is not signed in gets the sign-in gate and nothing else', () => {
  const screen = read(SCREEN)
  const route = screenFunction(screen, 'DesignMySpaceScreen')

  // The route renders exactly two things: the boards for a signed-in owner,
  // or the gate. There is no third, signed-out way in.
  assert.ok(route.includes("if (access.state === 'signed-in') {"))
  assert.ok(route.includes('<DesignMySpaceBoards key={access.owner.userId} owner={access.owner} />'))
  assert.ok(route.includes("<DesignMySpaceGate restoring={access.state === 'restoring'} onBack={leaveDesignMySpace} />"))
  assert.equal((screen.match(/<DesignMySpaceBoards\b/g) ?? []).length, 1, 'the boards render from somewhere unguarded')

  // The gate is the app's existing pattern (Favourites): sign in or register.
  // Shared by every Design My Space screen, so it lives in one component.
  const gate = read(GATE)
  assert.ok(gate.includes("router.push('/login')"))
  assert.ok(gate.includes("router.push('/register')"))
  assert.ok(gate.includes("t('designMySpace.gateTitle')"))
  // ...and offers no board, draft, palette or storage of any kind.
  for (const reach of ['loadDesignBoards', 'saveDesignBoardFor', 'deleteDesignBoardFor', 'useStudioPalette', 'DesignSavedBoardCard', 'startNewDesign', 'owner']) {
    assert.equal(gate.includes(reach), false, `the sign-in gate reaches ${reach}`)
  }

  // Every board operation needs an owner, which only a signed-in session has.
  const boards = screenFunction(screen, 'DesignMySpaceBoards')
  assert.ok(boards.includes('{ owner }: { owner: DesignBoardOwner }'))
})

test('23b. access: restoring is not signed out, and only a complete session is signed in', () => {
  const route = screenFunction(read(SCREEN), 'DesignMySpaceScreen')
  assert.ok(route.includes('designMySpaceAccess(status, userId, token)'))

  const sync = read('src/features/design-my-space/design-board-sync.ts')
  const body = sync.slice(sync.indexOf('export function designMySpaceAccess'))
  // Order matters: the loading check comes first.
  assert.ok(body.indexOf("status === 'loading'") < body.indexOf("status === 'authenticated'"))

  // While restoring, the gate shows a spinner — never the sign-in prompt.
  const gate = read(GATE)
  assert.ok(gate.indexOf('{restoring ? (') < gate.indexOf('<ActivityIndicator'))
  assert.ok(gate.indexOf('<ActivityIndicator') < gate.indexOf("router.push('/login')"))
})

test('23c. the anonymous device store is gone from the app', () => {
  assert.equal(fs.existsSync(path.join(ROOT, 'src/features/design-my-space/design-board-repository.ts')), false)

  const sources = []
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const relative = `${dir}/${entry.name}`
      if (entry.isDirectory()) walk(relative)
      else if (/\.(ts|tsx)$/.test(entry.name)) sources.push(relative)
    }
  }
  walk('src')

  for (const file of sources) {
    const source = read(file)
    assert.equal(source.includes('design-board-repository'), false, `${file} imports the removed device store`)
    // The old key may only be NAMED (in comments explaining why it is left alone),
    // never used as a string a storage call could read or write.
    assert.equal(/['"]varlikent_design_boards_v1['"]/.test(source), false, `${file} still uses the anonymous storage key`)
  }
})

test('24. storage and HTTP stay behind the sync layer, never in the screen', () => {
  const screen = read(SCREEN)

  assert.equal(/AsyncStorage|apiRequest|fetch\(|\/design-boards/.test(screen), false, 'the screen talks to storage or the API directly')
  for (const name of ['saveDesignBoard(', 'deleteDesignBoard(', 'saveAccountDesignBoard', 'deleteAccountDesignBoard']) {
    assert.equal(screen.includes(name), false, `the screen bypasses design-board-sync with ${name}`)
  }
  // Both go through the sync layer, with the owner as the first argument.
  // (Matched across line breaks: the call may be wrapped.)
  assert.match(screen, /saveDesignBoardFor\(\s*owner/)
  assert.match(screen, /deleteDesignBoardFor\(\s*owner/)
})

test('25. logging out or switching account leaves nothing of the previous user on screen', () => {
  const screen = read(SCREEN)
  const boards = screenFunction(screen, 'DesignMySpaceBoards')

  // All board state — list, draft, open board — lives in the component keyed
  // by the user id, so it is unmounted on logout and rebuilt empty for the
  // next account in the same render, with no effect-timing window.
  for (const state of ['useState<DesignBoard[]>([])', 'useState<DesignDraft>(EMPTY_DESIGN_DRAFT)', 'useState(createDesignBoardId)']) {
    assert.ok(boards.includes(state), `${state} is not owned by the keyed component`)
  }
  const route = screenFunction(screen, 'DesignMySpaceScreen')
  assert.equal(/useState|useRef|useEffect/.test(route), false, 'the route holds state that would survive an account change')

  // List loads are sequenced, so a slow load cannot overwrite a newer one.
  assert.ok(boards.includes('const load = ++loadRef.current;'))
})
