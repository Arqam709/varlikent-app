// Home's About preview, the /about screen, and their wiring.
//
// The app has no component-rendering test harness (no Jest or test renderer),
// so rendering decisions live in pure functions covered by about-content.test.mjs
// and about-repository.test.mjs. This file pins the WIRING those tests cannot
// see: where the preview sits on Home, that both screens use the shared source
// and resolve per language, navigation and back behaviour, that no tab was
// added, and that CMS content never leaked into the app's translation files.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

/** Source with comments removed, so documentation cannot satisfy a check. */
const code = (relative) =>
  read(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')

const LANGS = ['en', 'tr', 'ar', 'de', 'ru', 'ur']
const bundles = {}

before(() => {
  for (const lang of LANGS) {
    const { outputText } = ts.transpileModule(read(`src/features/localization/translations/${lang}.ts`), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    })
    const module = { exports: {} }
    new Function('exports', 'module', 'require', outputText)(module.exports, module, () => ({}))
    bundles[lang] = module.exports[lang]
  }
})

const HOME = 'src/app/(tabs)/index.tsx'
const PREVIEW = 'src/components/home/home-about-preview.tsx'
const SCREEN = 'src/app/about.tsx'

/* ══════════════ Home ══════════════ */

test('Home renders the About preview after Services and before Contact, order otherwise unchanged', () => {
  const home = code(HOME)
  const order = ['<HomeHero />', '<HomeDiscovery />', '<HomeFeaturedProperties />', '<HomeServicesPreview />', '<HomeAboutPreview />', '<HomeContact />']
  const positions = order.map((element) => home.indexOf(element))

  assert.ok(positions.every((p) => p >= 0), `missing: ${order.filter((_, i) => positions[i] < 0)}`)
  assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'Home section order changed')
  assert.equal(home.split('<HomeAboutPreview />').length, 2, 'rendered more than once')
  assert.ok(home.includes("import HomeAboutPreview from '@/components/home/home-about-preview';"))
})

test('About loading never gates Home: the screen has no About state or request of its own', () => {
  const home = code(HOME)
  for (const forbidden of ['useAboutContent', 'fetchAboutContent', 'refreshAboutContent', "'/about'"]) {
    assert.equal(home.includes(forbidden), false, `Home itself references ${forbidden}`)
  }
})

test('no bottom tab was added', () => {
  const tabs = code('src/app/(tabs)/_layout.tsx')
  const names = [...tabs.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((m) => m[1])
  assert.deepEqual(names, ['index', 'properties', 'chats', 'account'])
  assert.equal(fs.existsSync(path.join(ROOT, 'src/app/(tabs)/about.tsx')), false)
})

/* ══════════════ The preview ══════════════ */

test('the preview reads the shared source and resolves it for the current language', () => {
  const preview = code(PREVIEW)

  assert.ok(preview.includes('const { content } = useAboutContent();'))
  assert.ok(preview.includes('selectAboutPreview(resolveAboutContent(content, language))'))
  assert.ok(preview.includes('[content, language]'), 'a language change must re-resolve')
  for (const forbidden of ['apiRequest', 'fetch(', 'AsyncStorage', 'team', 'Team']) {
    assert.equal(preview.includes(forbidden), false, `the preview uses ${forbidden} directly`)
  }
})

test('the preview uses the design system, theme and direction helpers', () => {
  const preview = code(PREVIEW)
  for (const expected of ['<SectionHeader', '<Button', 'useThemedStyles(makeStyles)', 'useDirection()', '{ textAlign }', '{ flexDirection: row }']) {
    assert.ok(preview.includes(expected), `missing ${expected}`)
  }
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(preview), false, 'hardcoded colour in the preview')
})

test('Learn More navigates in-app to /about', () => {
  const preview = code(PREVIEW)
  assert.ok(preview.includes("label={t('about.learnMore')}"))
  assert.ok(preview.includes("onPress={() => router.push('/about')}"))
  assert.equal(/Linking|WebBrowser|openURL/.test(preview), false, 'About must not open the website')
})

test('the preview renders nothing rather than an empty section, and survives a broken image', () => {
  const preview = code(PREVIEW)
  assert.ok(preview.includes('if (!preview) return null;'))
  assert.ok(preview.includes("preview.image !== ''"))
  assert.ok(preview.includes('onError={() => setFailedImage(preview.image)}'))
  assert.ok(preview.includes('preview.stats.length > 0'), 'an empty figures row would render')
})

/* ══════════════ The full screen ══════════════ */

test('the screen has a header whose back falls back to Home', () => {
  const screen = code(SCREEN)
  assert.ok(screen.includes("<ScreenHeader title={t('about.title')} onBack={handleBack} />"))
  assert.ok(/if \(router\.canGoBack\(\)\) router\.back\(\);\s*else router\.replace\('\/'\);/.test(screen))
})

test('the screen reads the same shared source and resolves per language', () => {
  const screen = code(SCREEN)
  assert.ok(screen.includes('const { content, origin, status, retry } = useAboutContent();'))
  assert.ok(screen.includes('resolveAboutContent(content, language)'))
  assert.ok(screen.includes('[content, language]'))
  for (const forbidden of ['apiRequest', 'fetch(', 'AsyncStorage', "'/team'", 'teamHeading', 'team.']) {
    assert.equal(screen.includes(forbidden), false, `the screen uses ${forbidden}`)
  }
})

test('optional content is guarded, so nothing renders as blank or "undefined"', () => {
  const screen = code(SCREEN)
  for (const guard of [
    'about.heroHeading ?',
    'about.heroSubtext ?',
    'canShowImage(about.missionImage) ?',
    'about.missionHeading ?',
    'about.stats.length > 0 ?',
    'block.heading ?',
    'canShowImage(block.image) ?',
  ]) {
    assert.ok(screen.includes(guard), `unguarded: ${guard}`)
  }
  assert.ok(screen.includes("eyebrow={about.heroLabel || undefined}"))
})

test('retry appears only when there is genuinely nothing better than the baseline to show', () => {
  const screen = code(SCREEN)
  assert.ok(screen.includes("const showRefreshNotice = origin === 'fallback' && status === 'error';"))
  assert.ok(screen.includes('const hasContent = hasAboutScreenContent(about);'))
  assert.ok(screen.includes("{status === 'loading' ? ("), 'no content + loading must not show an error')
  assert.equal((screen.match(/onPress=\{retry\}/g) ?? []).length, 2)
})

test('the screen follows the reading direction and the theme', () => {
  const screen = code(SCREEN)
  assert.ok(screen.includes('useDirection()'))
  assert.ok((screen.match(/\{ textAlign \}/g) ?? []).length >= 4)
  assert.ok(screen.includes('useThemedStyles(makeStyles)'))
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(screen), false, 'hardcoded colour on the screen')
})

/* ══════════════ One data path ══════════════ */

test('only the About API module requests /about', () => {
  const walk = (dir) => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${dir}/${entry.name}`
    return entry.isDirectory() ? walk(relative) : /\.tsx?$/.test(entry.name) ? [relative] : []
  })
  const requesting = walk('src').filter((file) => /apiRequest<[^>]*>\(\s*'\/about'/.test(read(file)))
  assert.deepEqual(requesting, ['src/features/about/about-api.ts'])
})

/* ══════════════ Translations: interface strings only ══════════════ */

const ABOUT_KEYS = ['title', 'previewEyebrow', 'learnMore', 'learnMoreA11y', 'imageA11y', 'refreshFailed', 'unavailableTitle', 'unavailableBody']

test('every about.* interface key exists in all six languages', () => {
  for (const lang of LANGS) {
    assert.deepEqual(Object.keys(bundles[lang].about), ABOUT_KEYS, `${lang}.about`)
    for (const key of ABOUT_KEYS) {
      assert.ok(bundles[lang].about[key].trim(), `${lang}.about.${key} is empty`)
    }
  }
  for (const lang of ['tr', 'ar', 'ru', 'ur']) {
    for (const key of ABOUT_KEYS) assert.notEqual(bundles[lang].about[key], bundles.en.about[key], `${lang}.about.${key} is English`)
  }
})

test('admin-managed About content was not copied into the translation files', () => {
  for (const lang of LANGS) {
    const source = read(`src/features/localization/translations/${lang}.ts`)
    for (const cmsText of ['A refined approach', 'premier luxury real estate agency', 'Our Mission', 'Our Story', 'Meet Our Experts', 'market insight']) {
      assert.equal(source.includes(cmsText), false, `${lang}.ts contains About CMS text: ${cmsText}`)
    }
  }
})

test('every t() key the About UI uses exists in English', () => {
  for (const file of [PREVIEW, SCREEN]) {
    for (const [, key] of code(file).matchAll(/\bt\('([a-zA-Z.]+)'\)/g)) {
      const value = key.split('.').reduce((node, part) => node?.[part], bundles.en)
      assert.equal(typeof value, 'string', `${file}: ${key} is missing`)
    }
  }
})
