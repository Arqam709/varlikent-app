// About content follows the selected language — when the backend has it.
//
// ── The reported bug ────────────────────────────────────────────────────
// With the app in Turkish, the About interface strings were Turkish but the
// About CMS text was English. The live GET /api/about stored `tr`, `ar`, `de`,
// `ru` and `ur` as exact copies of the English text (a backend translation-
// pipeline defect, fixed in backend/utils/autoTranslate.js), so the app's
// resolver returned that "Turkish" value correctly.
//
// These tests pin that the app side was and stays right:
//   - real translations resolve per language, in Home and /about alike
//   - the screenshot state reproduces from English-copy data
//   - normalization and the cache keep every language
//   - fresh translated server content replaces older English-only content,
//     and a language switch needs no refetch
//   - CMS text never lives in the app's translation bundles
//
// Pure: modules transpiled and run with their imports stubbed.

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

let api = async () => ({})
let apiCalls = 0
const storage = new Map()

const asyncStorage = {
  __esModule: true,
  default: {
    getItem: async (key) => (storage.has(key) ? storage.get(key) : null),
    setItem: async (key, value) => { storage.set(key, value) },
  },
}

let content
let cache
let repo
let turkishBundle

before(() => {
  const localized = load('src/features/localization/localized-content.ts')
  content = load('src/features/about/about-content.ts', { '@/features/localization/localized-content': localized })
  const aboutApi = load('src/features/about/about-api.ts', {
    '@/features/about/about-content': content,
    '@/services/api-client': { apiRequest: (p) => { apiCalls += 1; return api(p) } },
  })
  cache = load('src/features/about/about-cache.ts', {
    '@react-native-async-storage/async-storage': asyncStorage,
    '@/features/about/about-content': content,
  })
  repo = load('src/features/about/about-repository.ts', {
    '@/features/about/about-api': aboutApi,
    '@/features/about/about-cache': cache,
  })
  turkishBundle = load('src/features/localization/translations/tr.ts', { './en': {} }).tr
})

beforeEach(() => {
  api = async () => ({})
  apiCalls = 0
  storage.clear()
  repo.resetAboutContentMemory()
})

const settle = () => new Promise((resolve) => setImmediate(resolve))

const LANGS = ['en', 'tr', 'ar', 'de', 'ru', 'ur']

const MISSION_LABEL = { sourceLang: 'en', en: 'Our Mission', tr: 'Misyonumuz', ar: 'مهمتنا', de: 'Unsere Mission', ru: 'Наша миссия', ur: 'ہمارا مشن' }
const MISSION_HEADING = {
  sourceLang: 'en',
  en: 'A refined approach to luxury real estate.',
  tr: 'Lüks gayrimenkule rafine bir yaklaşım.',
  ar: 'نهج راقٍ للعقارات الفاخرة.',
  de: 'Ein raffinierter Ansatz für Luxusimmobilien.',
  ru: 'Изысканный подход к элитной недвижимости.',
  ur: 'لگژری رئیل اسٹیٹ کے لیے ایک نفیس انداز۔',
}
const HERO_SUBTEXT = {
  sourceLang: 'en',
  en: "Istanbul's premier luxury real estate agency.",
  tr: "İstanbul'un önde gelen lüks emlak ajansı.",
  ar: 'وكالة العقارات الفاخرة الرائدة في إسطنبول.',
  de: 'Istanbuls führende Luxusimmobilienagentur.',
  ru: 'Ведущее агентство элитной недвижимости Стамбула.',
  ur: 'استنبول کی ممتاز لگژری رئیل اسٹیٹ ایجنسی۔',
}

const translatedResponse = () => ({
  success: true,
  about: {
    heroLabel: { sourceLang: 'en', en: 'Our Story', tr: 'Hikayemiz', ar: 'قصتنا', de: 'Unsere Geschichte', ru: 'Наша история', ur: 'ہماری کہانی' },
    heroHeading: { sourceLang: 'en', en: 'About Varlikent', tr: 'Varlikent Hakkında', ar: 'عن Varlikent', de: 'Über Varlikent', ru: 'О Varlikent', ur: 'Varlikent کے بارے میں' },
    heroSubtext: HERO_SUBTEXT,
    missionLabel: MISSION_LABEL,
    missionHeading: MISSION_HEADING,
    missionParagraph1: { sourceLang: 'en', en: 'We bring together market insight.', tr: 'Pazar içgörüsünü bir araya getiriyoruz.' },
    stats: [{ value: '10+', label: { sourceLang: 'en', en: 'Years Experience', tr: 'Yıllık Deneyim', ar: 'سنوات الخبرة' }, order: 0 }],
    contentBlocks: [{ heading: { en: 'Heritage', tr: 'Miras', ur: 'ورثہ' }, paragraphs: [{ en: 'Rooted in Istanbul.', tr: "İstanbul'a kök salmış." }], order: 0 }],
  },
})

/** Live data before the backend fix: every language is the English sentence. */
const copies = (text) => Object.fromEntries([['sourceLang', 'en'], ...LANGS.map((lang) => [lang, text])])
const englishCopyResponse = () => ({
  success: true,
  about: {
    heroLabel: copies('Our Story'),
    heroHeading: copies('About Varlikent'),
    heroSubtext: copies("Istanbul's premier luxury real estate agency."),
    missionLabel: copies('Our Mission'),
    missionHeading: copies('A refined approach to luxury real estate.'),
  },
})

/* ══════════════ Resolution ══════════════ */

test('each of the six languages shows its own backend translation', () => {
  for (const lang of LANGS) {
    const resolved = content.resolveAboutContent(content.normalizeAboutContent(translatedResponse()), lang)
    assert.equal(resolved.missionLabel, MISSION_LABEL[lang], `${lang} mission label`)
    assert.equal(resolved.missionHeading, MISSION_HEADING[lang], `${lang} mission heading`)
    assert.equal(resolved.heroSubtext, HERO_SUBTEXT[lang], `${lang} hero subtext`)
  }
})

test('English still shows English when Turkish exists', () => {
  const resolved = content.resolveAboutContent(content.normalizeAboutContent(translatedResponse()), 'en')
  assert.equal(resolved.missionLabel, 'Our Mission')
})

test('a missing translation falls back to English, per field', () => {
  const resolved = content.resolveAboutContent(content.normalizeAboutContent(translatedResponse()), 'ar')
  assert.deepEqual(resolved.missionParagraphs, ['We bring together market insight.'])
  assert.deepEqual(resolved.contentBlocks[0].paragraphs, ['Rooted in Istanbul.'])
  assert.equal(resolved.contentBlocks[0].heading, 'Heritage')
  assert.deepEqual(resolved.stats, [{ value: '10+', label: 'سنوات الخبرة' }])
})

test('the screenshot reproduces from English-copy data: Turkish interface, English content', () => {
  const resolved = content.resolveAboutContent(content.normalizeAboutContent(englishCopyResponse()), 'tr')
  const preview = content.selectAboutPreview(resolved)

  assert.equal(turkishBundle.about.previewEyebrow, 'Varlikent Hakkında', 'the interface string is Turkish')
  assert.equal(preview.heading, 'A refined approach to luxury real estate.', 'the CMS heading resolves the stored "tr" copy')
  assert.equal(preview.body, "Istanbul's premier luxury real estate agency.")
})

test('the same document with real translations renders Turkish in the Home preview and /about alike', () => {
  const resolved = content.resolveAboutContent(content.normalizeAboutContent(translatedResponse()), 'tr')
  const preview = content.selectAboutPreview(resolved)

  // /about renders `resolved` directly; Home renders `preview`, selected FROM it.
  assert.equal(preview.heading, resolved.missionHeading)
  assert.equal(preview.body, resolved.heroSubtext)
  assert.equal(preview.heading, 'Lüks gayrimenkule rafine bir yaklaşım.')
  assert.equal(resolved.heroHeading, 'Varlikent Hakkında')
  assert.equal(resolved.missionLabel, 'Misyonumuz')
})

test('both screens resolve the shared content with the current language', () => {
  for (const file of ['src/components/home/home-about-preview.tsx', 'src/app/about.tsx']) {
    const source = read(file)
    assert.ok(source.includes('useAboutContent()'), `${file} does not use the shared source`)
    assert.ok(source.includes('resolveAboutContent(content, language)'), `${file} does not resolve per language`)
    assert.ok(source.includes('[content, language]'), `${file} would not re-resolve on a language switch`)
  }
})

/* ══════════════ Normalization and cache keep every language ══════════════ */

test('normalization and a cache round trip keep all six languages on every field', async () => {
  const normalized = content.normalizeAboutContent(translatedResponse())
  await cache.writeCachedAboutContent(normalized)
  const restored = await cache.readCachedAboutContent()

  for (const field of ['heroLabel', 'heroHeading', 'heroSubtext', 'missionLabel', 'missionHeading']) {
    assert.deepEqual(Object.keys(restored[field]).filter((k) => k !== 'sourceLang').sort(), [...LANGS].sort(), field)
    assert.deepEqual(restored[field], translatedResponse().about[field])
  }
  assert.deepEqual(restored.stats[0].label, translatedResponse().about.stats[0].label)
  assert.deepEqual(restored.contentBlocks[0].heading, { en: 'Heritage', tr: 'Miras', ur: 'ورثہ' })
})

/* ══════════════ Fresh content replaces older content ══════════════ */

test('translated server content replaces a cached English-only document and is cached', async () => {
  await cache.writeCachedAboutContent(content.normalizeAboutContent(englishCopyResponse()))
  api = async () => translatedResponse()

  const events = []
  repo.subscribeAboutContent((entry) => events.push([entry.origin, content.resolveAboutContent(entry.content, 'tr').missionLabel]))

  assert.equal(await repo.refreshAboutContent(), true)
  await settle()

  assert.deepEqual(events.at(-1), ['server', 'Misyonumuz'])
  assert.equal(repo.peekAboutContent().origin, 'server')
  const recached = await cache.readCachedAboutContent()
  assert.equal(content.resolveAboutContent(recached, 'tr').missionLabel, 'Misyonumuz', 'the device cache was not updated')
})

test('an English-only cache read that lands after translated server content is discarded', async () => {
  let releaseCache
  const realGet = asyncStorage.default.getItem
  asyncStorage.default.getItem = () => new Promise((resolve) => { releaseCache = resolve })
  api = async () => translatedResponse()

  try {
    await repo.refreshAboutContent()
    releaseCache(JSON.stringify(content.normalizeAboutContent(englishCopyResponse())))
    await settle()

    assert.equal(repo.peekAboutContent().origin, 'server')
    assert.equal(content.resolveAboutContent(repo.peekAboutContent().content, 'tr').missionLabel, 'Misyonumuz')
  } finally {
    asyncStorage.default.getItem = realGet
  }
})

test('switching language re-resolves the same document without another request', async () => {
  api = async () => translatedResponse()
  await repo.refreshAboutContent()
  const document = repo.peekAboutContent().content

  const labels = LANGS.map((lang) => content.resolveAboutContent(document, lang).missionLabel)

  assert.deepEqual(labels, LANGS.map((lang) => MISSION_LABEL[lang]))
  assert.equal(apiCalls, 1, 'a language switch triggered a refetch')
})

/* ══════════════ The app bundles hold interface text only ══════════════ */

test('no About CMS text or its translations were added to the app translation files', () => {
  for (const lang of LANGS) {
    const bundle = read(`src/features/localization/translations/${lang}.ts`)
    for (const cms of ['Misyonumuz', 'Hikayemiz', 'Our Mission', 'Our Story', 'A refined approach', 'rafine bir yaklaşım', 'مهمتنا']) {
      assert.equal(bundle.includes(cms), false, `${lang}.ts contains About CMS text: ${cms}`)
    }
  }
})
