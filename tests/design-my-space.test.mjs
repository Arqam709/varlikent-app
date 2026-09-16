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
//      feature, an entry point only on Interior Design, and no palette request
//      from Home.

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
  // One route, not six.
  assert.deepEqual(
    fs.readdirSync(path.join(ROOT, 'src/app')).filter((name) => name.startsWith('design')),
    ['design-my-space.tsx']
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

test('20. no AI, camera, photo upload or AR anywhere in this feature', () => {
  const files = [
    SCREEN,
    'src/features/contact/contact-prefill.ts',
    ...fs.readdirSync(path.join(ROOT, 'src/features/design-my-space')).filter((f) => f.endsWith('.ts')).map((f) => `src/features/design-my-space/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'src/features/design-my-space/components')).map((f) => `src/features/design-my-space/components/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'src/features/studio-palette')).map((f) => `src/features/studio-palette/${f}`),
  ]

  const forbidden = /expo-image-picker|expo-camera|launchCamera|launchImageLibraryAsync|ImagePicker|openai|gemini|anthropic|generateImage|\/upload|ARKit|LiDAR/i

  for (const file of files) {
    const source = read(file)
    assert.equal(forbidden.test(source), false, `${file} reaches for a deferred capability`)
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

test('23. an anonymous visitor can use all of it', () => {
  const screen = read(SCREEN)
  const repository = read('src/features/design-my-space/design-board-repository.ts')

  assert.equal(/useAuth|requireAuth|token/.test(screen), false, 'the screen gates on a session')
  assert.equal(/useAuth|apiRequest|token/.test(repository), false, 'saving a board needs an account')
})
