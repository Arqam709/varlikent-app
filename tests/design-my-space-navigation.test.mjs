// Design My Space: what Back means, everywhere.
//
// Found on a real phone: Back on the finished board walked the user back
// through Lighting, Materials, Floor… The board already has "Edit Design" for
// that, so Back there now means "I am done" — it leaves for the Interior Design
// page, asking first only if the board has unsaved changes. Inside the six-step
// flow, Back still steps backwards.
//
// The rule is a pure function (design-my-space-navigation.ts), and every back
// control on the screen must route through the same handler.

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

const SCREEN = 'src/app/design-my-space.tsx'
const LANGS = ['en', 'tr', 'ar', 'de', 'ru', 'ur']

let nav
let db
const bundles = {}

before(() => {
  const remoteImage = load('src/utils/remote-image.ts')
  const sp = load('src/features/studio-palette/studio-palette.ts', { '@/utils/remote-image': remoteImage })
  const options = load('src/features/design-my-space/design-options.ts')
  db = load('src/features/design-my-space/design-board.ts', {
    '@/features/design-my-space/design-options': options,
    '@/features/studio-palette/studio-palette': sp,
    '@/utils/remote-image': remoteImage,
  })
  // The navigation module imports the board only as a type.
  nav = load('src/features/design-my-space/design-my-space-navigation.ts')
  for (const code of LANGS) {
    bundles[code] = load(`src/features/localization/translations/${code}.ts`, { './en': {} })[code]
  }
})

const complete = () => ({
  room: 'living-room',
  style: 'warm',
  wall: { label: 'Warm Sand', color: '#e8ddd0' },
  floor: { label: 'Dark Oak', color: '#4a3728' },
  materials: [],
  lighting: 'warm',
})

/* ═══════════════ The rule ═══════════════ */

test('1. Back on the board never returns to the Lighting step', () => {
  for (const unsaved of [true, false]) {
    const action = nav.resolveBackAction('board', 5, unsaved)
    assert.notEqual(action.type, 'previous-step', 'the board stepped back into the flow')
    assert.notEqual(action.type, 'landing')
  }
})

test('2. Back on the board leaves for Interior Design', () => {
  assert.deepEqual(nav.resolveBackAction('board', 5, false), { type: 'exit' })
  assert.equal(nav.DESIGN_MY_SPACE_EXIT_HREF, '/services/interior-design')
})

test('5. a brand-new completed board, never saved, warns before leaving', () => {
  const draft = complete()
  assert.equal(nav.hasUnsavedChanges(null, draft), true)
  assert.deepEqual(nav.resolveBackAction('board', 5, nav.hasUnsavedChanges(null, draft)), { type: 'confirm-exit' })
})

test('6. a saved board edited but not re-saved warns', () => {
  const saved = complete()
  const signature = nav.draftSignature(saved)
  const edited = { ...saved, lighting: 'night' }

  assert.equal(nav.hasUnsavedChanges(signature, edited), true)
  assert.deepEqual(nav.resolveBackAction('board', 5, nav.hasUnsavedChanges(signature, edited)), { type: 'confirm-exit' })
})

test('7. an unchanged saved board — opened, or just saved — exits without a warning', () => {
  // Opened from Saved Designs: the signature comes from the stored board.
  const stored = db.boardFromDraft(complete(), { id: 'dms-x', now: '2026-09-16T10:00:00.000Z' })
  const opened = db.draftFromBoard(stored)
  assert.equal(nav.hasUnsavedChanges(nav.draftSignature(db.draftFromBoard(stored)), opened), false)

  // Just saved: the signature is taken from the draft that was written.
  const draft = complete()
  assert.equal(nav.hasUnsavedChanges(nav.draftSignature(draft), draft), false)
  assert.deepEqual(nav.resolveBackAction('board', 5, false), { type: 'exit' })

  // Changing it and changing it back is not an unsaved change.
  const roundTrip = { ...draft, lighting: 'night' }
  roundTrip.lighting = 'warm'
  assert.equal(nav.hasUnsavedChanges(nav.draftSignature(draft), roundTrip), false)
})

test('9. inside the flow, Back steps backwards — and never warns or exits', () => {
  for (let step = 5; step >= 1; step -= 1) {
    for (const unsaved of [true, false]) {
      assert.deepEqual(nav.resolveBackAction('flow', step, unsaved), { type: 'previous-step', stepIndex: step - 1 })
    }
  }
  assert.deepEqual(nav.resolveBackAction('flow', 0, true), { type: 'landing' })
})

test('9b. from the landing view, Back leaves the feature normally', () => {
  assert.deepEqual(nav.resolveBackAction('landing', 0, false), { type: 'exit' })
  // Landing never shows a board, so nothing there can be unsaved.
  assert.deepEqual(nav.resolveBackAction('landing', 0, true), { type: 'exit' })
})

/* ═══════════════ The screen wires every control to it ═══════════════ */

test('3. an explicit "Back to Interior Design" action exists on the board, as a light link', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes("t('designMySpace.backToService')"), 'the board has no explicit exit')

  const boardBlock = screen.slice(screen.indexOf("{screen === 'board' && board ?"))
  const link = boardBlock.slice(boardBlock.indexOf('<Pressable'), boardBlock.indexOf("t('designMySpace.backToService')"))
  assert.ok(link.includes('onPress={handleBack}'))
  // Not another large Button.
  assert.equal(/<Button[^>]*backToService/s.test(boardBlock), false)
})

test('4 & 10. header, hardware Back, the step Back button and the exit link share ONE handler', () => {
  const screen = read(SCREEN)

  assert.ok(screen.includes('onBack={handleBack}'), 'the header has its own back logic')
  assert.ok(screen.includes("BackHandler.addEventListener('hardwareBackPress', handleBack)"), 'hardware Back has its own logic')
  assert.ok((screen.match(/onPress=\{handleBack\}/g) ?? []).length >= 2, 'the step Back button or the exit link bypasses the handler')

  // There is one decision, and it is the shared rule.
  assert.equal((screen.match(/resolveBackAction\(/g) ?? []).length, 1)
  assert.equal(/goBack\(|handleHeaderBack/.test(screen), false, 'an older, divergent back path remains')
  assert.equal(/setStepIndex\(DESIGN_STEPS\.length - 1\)/.test(screen), false, 'the board can still step back to Lighting')

  // Leaving always goes to the same place.
  assert.equal((screen.match(/router\.dismissTo\(DESIGN_MY_SPACE_EXIT_HREF\)/g) ?? []).length, 1)
  assert.equal(/router\.(back|replace)\(/.test(screen), false, 'an exit path skips the shared destination')
})

test('10b. hardware Back is only intercepted while the screen is focused', () => {
  // Contact is pushed on top of the board. A listener left registered under it
  // would swallow Contact's own Back press.
  const screen = read(SCREEN)
  assert.ok(/useFocusEffect\(\s*useCallback\(\(\) => \{\s*const subscription = BackHandler\.addEventListener/.test(screen))
})

test('5–7. the confirmation is shown only for the confirm-exit case, with Stay and Leave', () => {
  const screen = read(SCREEN)
  const confirm = screen.slice(screen.indexOf("case 'confirm-exit':"), screen.indexOf("case 'exit':"))

  assert.ok(confirm.includes("Alert.alert(t('designMySpace.leaveTitle'), t('designMySpace.leaveBody')"))
  assert.ok(confirm.includes("t('designMySpace.stay'), style: 'cancel'"), 'Stay must be the safe, cancelling choice')
  assert.ok(confirm.includes("t('designMySpace.leave'), style: 'destructive', onPress: leaveDesignMySpace"))
  assert.equal((screen.match(/Alert\.alert\(t\('designMySpace\.leaveTitle'\)/g) ?? []).length, 1)

  assert.ok(screen.includes('const unsaved = hasUnsavedChanges(savedDraft, draft);'))
  assert.ok(screen.includes('resolveBackAction(screen, stepIndex, unsaved)'))
})

test('8. Edit Design still returns to the six steps', () => {
  const screen = read(SCREEN)
  const boardBlock = screen.slice(screen.indexOf("{screen === 'board' && board ?"))
  const edit = boardBlock.slice(0, boardBlock.indexOf("t('designMySpace.edit')"))

  assert.ok(/setStepIndex\(0\);\s*setScreen\('flow'\);/.test(edit), 'Edit Design no longer opens the flow')
})

test('board action hierarchy: one primary, two secondary, two light links', () => {
  const screen = read(SCREEN)
  const boardBlock = screen.slice(screen.indexOf("{screen === 'board' && board ?"), screen.indexOf('function StepOptions'))

  // Request Consultation (primary), Save Design and Visualize in My Room (secondary).
  assert.equal((boardBlock.match(/<Button\b/g) ?? []).length, 3, 'the board should have exactly three buttons')
  assert.ok(boardBlock.indexOf("t('designMySpace.save')") < boardBlock.indexOf("t('designMySpace.roomPhoto.visualizeCta')"), 'Visualize must follow Save')
  assert.ok(/label=\{t\('designMySpace\.roomPhoto\.visualizeCta'\)\}\s*variant="secondary"/.test(boardBlock), 'Visualize must not compete with the primary action')
  assert.ok(boardBlock.indexOf("requestConsultation')") < boardBlock.indexOf("t('designMySpace.save')"), 'Request Consultation must lead')
  assert.equal(/<Button[^>]*requestConsultation[^>]*variant="secondary"/s.test(boardBlock), false)
  assert.ok(/label=\{isSaved \? t\('designMySpace\.savedLabel'\) : t\('designMySpace\.save'\)\}\s*variant="secondary"/.test(boardBlock))
  assert.ok(boardBlock.indexOf("t('designMySpace.edit')") < boardBlock.indexOf("t('designMySpace.backToService')"))
})

test('17. every language has the new exit strings', () => {
  for (const code of LANGS) {
    for (const key of ['backToService', 'leaveTitle', 'leaveBody', 'stay', 'leave']) {
      const value = bundles[code].designMySpace[key]
      assert.equal(typeof value, 'string', `${code} is missing designMySpace.${key}`)
      assert.ok(value.trim(), `${code} designMySpace.${key} is empty`)
      if (code !== 'en') assert.notEqual(value, bundles.en.designMySpace[key], `${code} ${key} is untranslated`)
    }
  }
})

test('content clears the Android navigation bar', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes('useSafeAreaInsets()'))
  assert.ok(screen.includes('paddingBottom: Spacing.xl + insets.bottom'))
})
