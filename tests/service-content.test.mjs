// Service page content (features/services/service-content.ts).
//
// The four service screens render the website's admin-managed Page Content,
// with the app's bundled copy as fallback. These tests pin normalization
// (what is kept from GET /api/page-content/:pageKey), precedence (server text
// over fallback), visibility (a hidden section never comes back from the
// fallback), localization and ordering — for every service.
//
// Pure: modules transpiled and run with their imports provided.

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

let sc
let fallback

before(() => {
  const localized = load('src/features/localization/localized-content.ts')
  fallback = load('src/features/services/service-content-fallback.ts').SERVICE_CONTENT_FALLBACK
  sc = load('src/features/services/service-content.ts', {
    '@/features/localization/localized-content': localized,
    '@/features/services/service-content-fallback': { SERVICE_CONTENT_FALLBACK: fallback },
  })
})

const IDS = ['architecture', 'construction', 'renovation', 'interior-design']
const LANGS = ['en', 'tr', 'ar', 'de', 'ru', 'ur']

/** A field exactly as PageContent stores it. */
const stored = (en, extra = {}) => ({ type: 'text', sourceLang: 'en', en, ...extra })

const kinds = (page) => page.sections.map((section) => section.kind)

/* ══════════════ Mapping ══════════════ */

test('service ids map explicitly to backend page keys and showroom categories', () => {
  assert.deepEqual(
    Object.fromEntries(IDS.map((id) => [id, [sc.SERVICE_PAGES[id].pageKey, sc.SERVICE_PAGES[id].showroomCategory]])),
    {
      architecture: ['architecture', 'architecture'],
      construction: ['construction', 'construction'],
      renovation: ['renovation', 'renovation'],
      'interior-design': ['interior-design', 'interior'],
    }
  )
})

test('with no server document every service renders its sections in the website’s order', () => {
  const expected = {
    architecture: ['showroom', 'services', 'process', 'cta'],
    construction: ['services', 'process', 'seismic', 'showroom', 'cta'],
    renovation: ['transform', 'services', 'showroom', 'cta'],
    'interior-design': ['showroom', 'services', 'cta'],
  }
  for (const id of IDS) {
    assert.deepEqual(kinds(sc.resolveServicePage(id, null, 'en')), expected[id], id)
  }
})

/* ══════════════ Normalization ══════════════ */

for (const id of IDS) {
  test(`${id}: a valid response keeps shared fields and drops everything else`, () => {
    const map = sc.SERVICE_PAGES[id]
    const payload = {
      success: true,
      _id: 'x',
      __v: 3,
      createdAt: '2026-01-01',
      fields: {
        heroHeading: stored('Server heading', { tr: 'Sunucu başlığı' }),
        heroCtaSecondary: stored('Website-only anchor'),
        [map.websiteOnly.fields.at(-1)]: stored('Website-only field'),
        unknownField: stored('Unknown'),
        constructor: stored('Prototype name'),
      },
      sections: { cta: false, [map.websiteOnly.sections[0]]: false, madeUp: false },
    }

    const content = sc.normalizeServiceContent(id, payload)

    assert.deepEqual(Object.keys(content).sort(), ['fields', 'hiddenSections', 'pageKey'])
    assert.equal(content.pageKey, map.pageKey)
    assert.deepEqual(Object.keys(content.fields), ['heroHeading'])
    assert.deepEqual(content.fields.heroHeading, { en: 'Server heading', tr: 'Sunucu başlığı', sourceLang: 'en' })
    assert.deepEqual(content.hiddenSections, ['cta'], 'only rendered sections are tracked')
  })
}

test('old scalar string fields are accepted', () => {
  const content = sc.normalizeServiceContent('architecture', { fields: { heroHeading: 'Legacy heading' }, sections: {} })
  assert.equal(content.fields.heroHeading, 'Legacy heading')
  assert.equal(sc.resolveServicePage('architecture', content, 'ar').hero.heading, 'Legacy heading')
})

test('malformed, blank and wrongly typed fields fall back instead of rendering', () => {
  const content = sc.normalizeServiceContent('renovation', {
    fields: {
      heroHeading: stored('   '),
      heroSubtitle: { type: 'image', url: 'https://x.com/a.png' },
      heroLabel: 42,
      servicesHeading: null,
      ctaBody: ['not text'],
      service1Title: { type: 'text', fr: 'Titre' },
    },
    sections: { transform: 'false', services: 0 },
  })

  assert.deepEqual(content.fields, {})
  assert.deepEqual(content.hiddenSections, [], 'only a literal false hides a section')
  const page = sc.resolveServicePage('renovation', content, 'en')
  assert.equal(page.hero.heading, fallback.renovation.heroHeading.en)
})

test('payloads that are not a PageContent document normalize to null', () => {
  for (const payload of [null, undefined, 'x', 42, [], {}, { success: false, fields: {} }, { images: [] }]) {
    assert.equal(sc.normalizeServiceContent('architecture', payload), null, JSON.stringify(payload))
  }
  assert.equal(sc.normalizeServiceContent('architecture', { pageKey: 'construction', fields: {} }), null, 'another page’s document')
  assert.equal(sc.normalizeServiceContent('gardening', { fields: {} }), null)
})

test('a page nobody has edited is a valid document: nothing overridden, nothing hidden', () => {
  const content = sc.normalizeServiceContent('interior-design', { success: true, fields: {}, sections: {} })
  assert.deepEqual(content, { pageKey: 'interior-design', fields: {}, hiddenSections: [] })
  assert.deepEqual(sc.resolveServicePage('interior-design', content, 'tr'), sc.resolveServicePage('interior-design', null, 'tr'))
})

test('normalization never mutates the response', () => {
  const payload = { fields: { heroHeading: stored('Heading', { _id: 'y' }) }, sections: { cta: false } }
  const copy = structuredClone(payload)
  sc.normalizeServiceContent('architecture', payload)
  assert.deepEqual(payload, copy)
})

test('a serialized document normalizes back to itself (the cache round trip)', () => {
  const content = sc.normalizeServiceContent('construction', {
    fields: { seismicBody: stored('Body', { tr: 'Gövde', ur: 'متن' }) },
    sections: { showroom: false },
  })
  const restored = sc.normalizeServiceContent('construction', JSON.parse(JSON.stringify(sc.serializeServiceContent(content))))
  assert.deepEqual(restored, content)
})

test('Construction’s cards and steps are app-bundled: a server value for them is ignored', () => {
  const content = sc.normalizeServiceContent('construction', {
    fields: { service1Title: stored('Injected card'), processStep1: stored('Injected step') },
    sections: {},
  })
  assert.deepEqual(content.fields, {})
  const page = sc.resolveServicePage('construction', content, 'en')
  const services = page.sections.find((s) => s.kind === 'services')
  assert.equal(services.items[0].title, fallback.construction.service1Title.en)
  assert.equal(page.sections.find((s) => s.kind === 'process').steps.length, 5)
})

/* ══════════════ Precedence and localization ══════════════ */

test('saved server text wins over the bundled copy, requested language first', () => {
  const content = sc.normalizeServiceContent('architecture', {
    fields: { heroHeading: stored('Architecture Studio', { tr: 'Mimarlık Stüdyosu', ar: 'استوديو العمارة' }) },
    sections: {},
  })

  assert.equal(sc.resolveServicePage('architecture', content, 'tr').hero.heading, 'Mimarlık Stüdyosu')
  assert.equal(sc.resolveServicePage('architecture', content, 'ar').hero.heading, 'استوديو العمارة')
  assert.equal(sc.resolveServicePage('architecture', content, 'en').hero.heading, 'Architecture Studio')
  // No German on the server field: English, not the old bundled German.
  assert.equal(sc.resolveServicePage('architecture', content, 'de').hero.heading, 'Architecture Studio')
})

test('every language resolves its own bundled copy while nothing is saved', () => {
  for (const id of IDS) {
    for (const lang of LANGS) {
      const page = sc.resolveServicePage(id, null, lang)
      assert.equal(page.hero.heading, fallback[id].heroHeading[lang], `${id} ${lang}`)
      assert.equal(page.hero.ctaPrimary, fallback[id].heroCtaPrimary[lang], `${id} ${lang} hero CTA`)
    }
  }
})

test('switching language re-resolves the same document — no second document needed', () => {
  const content = sc.normalizeServiceContent('renovation', {
    fields: { transformHeading: stored('Before & After', { tr: 'Öncesi ve Sonrası', ru: 'До и после', ur: 'پہلے اور بعد' }) },
    sections: {},
  })
  const headings = LANGS.map((lang) => sc.resolveServicePage('renovation', content, lang).sections.find((s) => s.kind === 'transform').heading)
  assert.deepEqual(headings, ['Before & After', 'Öncesi ve Sonrası', 'Before & After', 'Before & After', 'До и после', 'پہلے اور بعد'])
})

/* ══════════════ Visibility ══════════════ */

test('a section the server hides is not rendered, even though a fallback exists', () => {
  for (const id of IDS) {
    for (const kind of sc.SERVICE_PAGES[id].sections) {
      const content = sc.normalizeServiceContent(id, { fields: {}, sections: { [kind]: false } })
      assert.equal(kinds(sc.resolveServicePage(id, content, 'en')).includes(kind), false, `${id} still shows ${kind}`)
    }
  }
})

test('with no server document, nothing is hidden', () => {
  for (const id of IDS) {
    assert.deepEqual(kinds(sc.resolveServicePage(id, null, 'en')), [...sc.SERVICE_PAGES[id].sections])
  }
})

/* ══════════════ No blanks ══════════════ */

test('resolved pages never contain undefined, null or empty sections', () => {
  for (const id of IDS) {
    for (const lang of LANGS) {
      const page = sc.resolveServicePage(id, null, lang)
      assert.equal(/undefined|null|\[object/.test(JSON.stringify(page)), false, `${id} ${lang}`)
      for (const section of page.sections) {
        if (section.kind === 'services') assert.ok(section.items.length > 0 || section.heading)
        if (section.kind === 'process') assert.ok(section.steps.length > 0 || section.heading)
        if (section.kind === 'cta') assert.ok(section.heading && section.button)
        if (section.kind === 'services') for (const item of section.items) assert.ok(item.title)
      }
    }
  }
})

/* ══════════════ The bundled fallback ══════════════ */

test('the fallback holds every shared and bundled field, in all six languages, and nothing else', () => {
  for (const id of IDS) {
    const map = sc.SERVICE_PAGES[id]
    const expected = [...map.sharedFields, ...map.bundledFields].sort()
    assert.deepEqual(Object.keys(fallback[id]).sort(), expected, id)
    for (const [field, value] of Object.entries(fallback[id])) {
      for (const lang of LANGS) assert.ok(typeof value[lang] === 'string' && value[lang].trim(), `${id}.${field}.${lang}`)
    }
  }
})
