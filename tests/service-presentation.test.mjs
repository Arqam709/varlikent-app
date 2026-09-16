// Service page mobile presentation.
//
// A real-phone test of Interior Design showed two "Book a Consultation"
// buttons — one in the hero, one closing the page — with Design My Space
// wedged between. On a phone that reads as repetition. Interior Design now
// leads with Design My Space and keeps ONE consultation button, at the end.
//
// This is a mobile presentation choice declared as service data
// (`heroContactCta: false`), not content: Page Content and the website are
// untouched, and the other three services keep their hero button.

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

const SCREEN = 'src/app/services/[service].tsx'

let services
let sc

before(() => {
  services = load('src/features/services/services-data.ts')
  const localized = load('src/features/localization/localized-content.ts')
  const fallback = load('src/features/services/service-content-fallback.ts')
  sc = load('src/features/services/service-content.ts', {
    '@/features/localization/localized-content': localized,
    '@/features/services/service-content-fallback': fallback,
  })
})

test('11. Interior Design shows no hero consultation button', () => {
  assert.equal(services.showsHeroContactCta(services.getService('interior-design')), false)

  const screen = read(SCREEN)
  assert.ok(screen.includes('{hero.ctaPrimary && showsHeroContactCta(service) ? ('), 'the hero button ignores the service setting')
})

test('14. Architecture, Construction and Renovation keep their hero button', () => {
  for (const id of ['architecture', 'construction', 'renovation']) {
    assert.equal(services.showsHeroContactCta(services.getService(id)), true, `${id} lost its hero CTA`)
  }
  // Declared on exactly one service.
  assert.equal((read('src/features/services/services-data.ts').match(/heroContactCta: false/g) ?? []).length, 1)
})

test('12. Interior Design still ends with the consultation CTA, which opens Contact', () => {
  const page = sc.resolveServicePage('interior-design', null, 'en')
  const cta = page.sections.find((section) => section.kind === 'cta')

  assert.ok(cta, 'the closing CTA section is gone')
  assert.ok(cta.button.trim(), 'the closing CTA has no button label')
  assert.equal(page.sections.at(-1).kind, 'cta', 'the closing CTA is no longer last')

  const screen = read(SCREEN)
  const ctaCase = screen.slice(screen.indexOf("case 'cta':"), screen.indexOf('default:', screen.indexOf("case 'cta':")))
  assert.ok(ctaCase.includes('onPress={openContact}'))
  // The hero-CTA setting does not reach the closing CTA.
  assert.equal(ctaCase.includes('showsHeroContactCta'), false)
})

test('the hero content itself is unchanged: it is presentation, not data', () => {
  // The website's hero button text still resolves for Interior Design — the
  // app just chooses not to draw a second consultation button on a phone.
  const page = sc.resolveServicePage('interior-design', null, 'en')
  assert.ok(page.hero.ctaPrimary.trim())
})

test('13. Design My Space is offered on Interior Design only, right after the hero', () => {
  assert.deepEqual(services.SERVICES.filter((s) => s.feature === 'design-my-space').map((s) => s.id), ['interior-design'])

  const screen = read(SCREEN)
  const hero = screen.indexOf('<ServiceHero')
  const entry = screen.indexOf("{service.feature === 'design-my-space' ? <DesignMySpaceEntry /> : null}")
  const sections = screen.indexOf('{page.sections.map(')
  assert.ok(hero < entry && entry < sections, 'Design My Space is not between the hero and the service content')
})

test('15. every Phase 3 section kind still renders', () => {
  const screen = read(SCREEN)
  for (const kind of ['showroom', 'services', 'process', 'transform', 'seismic', 'cta']) {
    assert.ok(screen.includes(`case '${kind}':`), `${kind} is no longer rendered`)
  }
  for (const id of ['architecture', 'construction', 'renovation', 'interior-design']) {
    assert.ok(sc.resolveServicePage(id, null, 'en').sections.length > 0, `${id} lost its sections`)
  }
  // Interior Design's four expertise cards are all still there.
  const services_ = sc.resolveServicePage('interior-design', null, 'en').sections.find((s) => s.kind === 'services')
  assert.equal(services_.items.length, 4)
})

test('compact hero: the icon sits beside the eyebrow, not in its own band', () => {
  const screen = read(SCREEN)
  const hero = screen.slice(screen.indexOf('function ServiceHero'), screen.indexOf('function SectionBlock'))

  assert.ok(hero.indexOf('styles.heroTop') < hero.indexOf('styles.heroTitle'), 'the icon row must precede the title')
  assert.ok(/<View style=\{\[styles\.heroTop, \{ flexDirection: row \}\]\}>/.test(hero), 'the icon row does not mirror in RTL')
  assert.equal(/marginTop: Spacing\.lg,\r?\n  \},\r?\n  heroCta/.test(screen), false)
})

test('mobile spacing uses tokens, and content clears the navigation bar', () => {
  const screen = read(SCREEN)
  const styles = screen.slice(screen.indexOf('const makeStyles'))

  assert.equal(/paddingTop: Spacing\.xxl/.test(styles), false, 'sections still use the desktop-sized gap')
  assert.ok(screen.includes('paddingBottom: Spacing.xl + insets.bottom'))
  assert.ok(screen.includes('useSafeAreaInsets()'))
})

test('16. no website or backend dependency in production code', () => {
  const files = [
    SCREEN,
    'src/app/design-my-space.tsx',
    'src/features/services/services-data.ts',
    'src/features/design-my-space/design-my-space-navigation.ts',
    'src/features/design-my-space/components/design-my-space-entry.tsx',
  ]
  for (const file of files) {
    assert.equal(/varlikent[\\/](frontend|backend)|\.\.\/\.\.\/varlikent/.test(read(file)), false, `${file} reaches into the website repo`)
  }
})

test('18–20. theme, direction, no hardcoded colour, no deferred capabilities', () => {
  const files = [
    SCREEN,
    'src/app/design-my-space.tsx',
    'src/features/design-my-space/components/design-my-space-entry.tsx',
    'src/features/design-my-space/components/design-board-summary.tsx',
  ]
  const forbidden = /expo-image-picker|expo-camera|ImagePicker|openai|gemini|anthropic|generateImage|LiDAR|ARKit/i

  for (const file of files) {
    const source = read(file)
    assert.ok(source.includes('useThemedStyles(makeStyles)'), `${file} does not use the theme`)
    assert.ok(source.includes('useDirection()'), `${file} ignores reading direction`)
    assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(source), false, `${file} hardcodes a colour`)
    assert.equal(/language === '(ar|ur)'/.test(source), false, `${file} checks language instead of direction`)
    assert.equal(forbidden.test(source), false, `${file} reaches for a deferred capability`)
  }
})
