// About Varlikent content model (features/about/about-content.ts).
//
// The app renders the website's About CMS document. These tests pin how that
// response is made safe: what is kept, what is dropped (Team, database
// internals, uncaptioned figures, unusable images), how it resolves per
// language, and what the Home preview selects.
//
// The LIVE fixture below mirrors the real GET /api/about response shape as of
// Phase 2: every localized value is an English copy, every stat label is
// `{ sourceLang: 'en', en: '' }`, team has entries, there are no content
// blocks, and Mongo internals are present.
//
// Pure: modules are transpiled and run with their one import provided.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const load = (relative, imports = {}) => {
  const source = fs.readFileSync(path.join(ROOT, relative), 'utf8')
  const { outputText } = ts.transpileModule(source, {
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

let about

before(() => {
  const localized = load('src/features/localization/localized-content.ts')
  about = load('src/features/about/about-content.ts', { '@/features/localization/localized-content': localized })
})

const copies = (text) => ({ sourceLang: 'en', en: text, tr: text, ar: text, de: text, ru: text, ur: text })

const LIVE = {
  success: true,
  about: {
    _id: '6a31ec1d7035026ef0dbd409',
    heroLabel: copies('Our Story'),
    heroHeading: copies('About Varlikent'),
    heroSubtext: copies("Istanbul's premier luxury real estate agency, connecting discerning buyers and renters with exceptional properties."),
    missionLabel: copies('Our Mission'),
    missionHeading: copies('A refined approach to luxury real estate.'),
    missionParagraph1: copies('We bring together market insight.'),
    missionParagraph2: copies('Founded with a passion for Istanbul.'),
    missionImage: 'https://res.cloudinary.com/dcsb48aov/image/upload/v1782429747/varlikent/z6qnhi9lzid3lnpcfcnw.png',
    teamLabel: copies('Our Team'),
    teamHeading: copies('Meet Our Experts'),
    stats: [
      { value: '10+', label: { sourceLang: 'en', en: '' }, order: 0, _id: 's1' },
      { value: '500+', label: { sourceLang: 'en', en: '' }, order: 1, _id: 's2' },
      { value: '120+', label: { sourceLang: 'en', en: '' }, order: 2, _id: 's3' },
      { value: '50+', label: { sourceLang: 'en', en: '' }, order: 3, _id: 's4' },
    ],
    team: [{ name: 'Deniz Arda Varlı', role: copies('Owner'), avatar: '', order: 1, _id: 't1' }],
    contentBlocks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    __v: 0,
  },
}

const TRANSLATED = {
  about: {
    heroLabel: { sourceLang: 'en', en: 'Our Story', tr: 'Hikayemiz', ar: 'قصتنا', ur: 'ہماری کہانی' },
    heroHeading: { sourceLang: 'en', en: 'About Varlikent', tr: 'Varlikent Hakkında', ar: 'عن فارليكنت' },
    heroSubtext: { sourceLang: 'en', en: 'Premier agency.', tr: 'Önde gelen ajans.', ar: 'وكالة رائدة.' },
    missionHeading: { sourceLang: 'en', en: 'A refined approach.', tr: 'Rafine bir yaklaşım.', ar: 'نهج راقٍ.' },
    missionParagraph1: { sourceLang: 'en', en: 'Paragraph one.', tr: 'Birinci paragraf.' },
    stats: [
      { value: '10+', label: { sourceLang: 'en', en: 'Years Experience', tr: 'Yıllık Deneyim', ar: 'سنوات الخبرة' }, order: 0 },
    ],
  },
}

/* ══════════════ The live document ══════════════ */

test('the live response normalizes, without Team or database internals', () => {
  const content = about.normalizeAboutContent(LIVE)

  assert.ok(content)
  assert.deepEqual(Object.keys(content).sort(), [
    'contentBlocks', 'heroHeading', 'heroLabel', 'heroSubtext', 'missionHeading', 'missionImage',
    'missionLabel', 'missionParagraph1', 'missionParagraph2', 'stats',
  ])
  const json = JSON.stringify(content)
  for (const excluded of ['team', 'Deniz', '_id', '__v', 'createdAt', 'updatedAt', 'Meet Our Experts']) {
    assert.equal(json.includes(excluded), false, `${excluded} reached the app's About content`)
  }
})

test('the live figures have blank captions, so none is shown — and none is invented', () => {
  const content = about.normalizeAboutContent(LIVE)
  assert.equal(content.stats.length, 4, 'the figures themselves are kept')

  for (const language of ['en', 'tr', 'ar', 'de', 'ru', 'ur']) {
    const resolved = about.resolveAboutContent(content, language)
    assert.deepEqual(resolved.stats, [], `${language} showed uncaptioned figures`)
    assert.deepEqual(about.selectAboutPreview(resolved).stats, [])
  }
})

test('the live mission image and text resolve', () => {
  const resolved = about.resolveAboutContent(about.normalizeAboutContent(LIVE), 'tr')

  assert.equal(resolved.missionImage, LIVE.about.missionImage)
  assert.equal(resolved.heroHeading, 'About Varlikent', 'Turkish shows what the document holds for Turkish')
  assert.deepEqual(resolved.missionParagraphs, ['We bring together market insight.', 'Founded with a passion for Istanbul.'])
})

test('normalization never mutates the response', () => {
  const input = structuredClone(LIVE)
  about.normalizeAboutContent(input)
  assert.deepEqual(input, LIVE)
})

test('normalized content survives a cache round trip unchanged', () => {
  const content = about.normalizeAboutContent(LIVE)
  assert.deepEqual(about.normalizeAboutContent(JSON.parse(JSON.stringify(content))), content)
})

/* ══════════════ Per language ══════════════ */

test('changing language resolves a different backend field, without renormalizing', () => {
  const content = about.normalizeAboutContent(TRANSLATED)

  assert.equal(about.resolveAboutContent(content, 'en').heroHeading, 'About Varlikent')
  assert.equal(about.resolveAboutContent(content, 'tr').heroHeading, 'Varlikent Hakkında')
  assert.equal(about.resolveAboutContent(content, 'ar').heroHeading, 'عن فارليكنت')
  assert.equal(about.resolveAboutContent(content, 'ur').heroLabel, 'ہماری کہانی')
  // No Urdu heading: English.
  assert.equal(about.resolveAboutContent(content, 'ur').heroHeading, 'About Varlikent')
  assert.deepEqual(about.resolveAboutContent(content, 'tr').stats, [{ value: '10+', label: 'Yıllık Deneyim' }])
  assert.deepEqual(about.resolveAboutContent(content, 'de').stats, [{ value: '10+', label: 'Years Experience' }])
})

test('old scalar-string documents still work', () => {
  const content = about.normalizeAboutContent({
    about: {
      heroHeading: 'About Varlikent',
      heroSubtext: 'A plain legacy string.',
      stats: [{ value: '10+', label: 'Years Experience' }],
    },
  })

  for (const language of ['en', 'ar']) {
    const resolved = about.resolveAboutContent(content, language)
    assert.equal(resolved.heroHeading, 'About Varlikent')
    assert.deepEqual(resolved.stats, [{ value: '10+', label: 'Years Experience' }])
  }
})

/* ══════════════ Missing and malformed ══════════════ */

test('missing optional fields become blanks, never "undefined" or "null"', () => {
  const content = about.normalizeAboutContent({ about: { heroHeading: 'About Varlikent' } })
  const resolved = about.resolveAboutContent(content, 'en')

  assert.deepEqual(resolved, {
    heroLabel: '', heroHeading: 'About Varlikent', heroSubtext: '', missionLabel: '', missionHeading: '',
    missionParagraphs: [], missionImage: '', stats: [], contentBlocks: [],
  })
  assert.equal(/undefined|null|\[object/.test(JSON.stringify(resolved)), false)
})

test('malformed or empty responses normalize to null, so callers keep what they show', () => {
  for (const payload of [
    null, undefined, 'about', 42, [], {}, { success: false }, { success: true, about: null }, { about: [] },
    { about: {} }, { about: { heroHeading: '', stats: [{ value: '10+', label: 'Years' }] } },
    { about: { heroHeading: { sourceLang: 'en', en: '   ' } } }, { about: { team: [{ name: 'X' }] } },
  ]) {
    assert.equal(about.normalizeAboutContent(payload), null, `${JSON.stringify(payload)} was accepted`)
  }
})

test('the about object itself is accepted as well as the response body', () => {
  assert.ok(about.normalizeAboutContent(LIVE.about))
})

/* ══════════════ Figures ══════════════ */

test('figures are ordered, need a value, and keep a caption from any language', () => {
  const content = about.normalizeAboutContent({
    about: {
      heroHeading: 'About',
      stats: [
        { value: '500+', label: 'Properties Listed', order: 2 },
        { value: '10+', label: { sourceLang: 'ru', ru: 'Лет опыта' }, order: 0 },
        { value: '', label: 'No figure', order: 1 },
        { label: 'Missing figure' },
        { value: 120, label: 'Happy Clients', order: 1 },
        null,
        'bad',
        { value: '50+', label: { sourceLang: 'en', en: '' }, order: 3 },
      ],
    },
  })

  assert.deepEqual(content.stats.map((s) => s.value), ['10+', '120', '500+', '50+'])
  assert.deepEqual(about.resolveAboutContent(content, 'en').stats, [
    { value: '10+', label: 'Лет опыта' },
    { value: '120', label: 'Happy Clients' },
    { value: '500+', label: 'Properties Listed' },
  ])
})

test('figures without an order keep their original sequence', () => {
  const content = about.normalizeAboutContent({
    about: { heroHeading: 'About', stats: [{ value: 'A', label: 'a' }, { value: 'B', label: 'b' }, { value: 'C', label: 'c' }] },
  })
  assert.deepEqual(content.stats.map((s) => s.value), ['A', 'B', 'C'])
})

/* ══════════════ Images ══════════════ */

test('only absolute http(s) images are used; videos and site-relative paths are omitted', () => {
  const cases = [
    ['https://res.cloudinary.com/x/image/upload/a.png', 'https://res.cloudinary.com/x/image/upload/a.png'],
    ['http://example.com/a.jpg', 'http://example.com/a.jpg'],
    ['  https://example.com/a.webp  ', 'https://example.com/a.webp'],
    ['', ''],
    ['/images/hero-villa.jpg.png', ''],
    ['https://res.cloudinary.com/x/video/upload/tour.mp4', ''],
    ['https://example.com/tour.MOV?v=1', ''],
    ['javascript:alert(1)', ''],
    ['https://exa mple.com/a.png', ''],
    [null, ''],
    [42, ''],
  ]
  for (const [input, expected] of cases) assert.equal(about.usableAboutImage(input), expected, String(input))
})

test('a document without an image still normalizes and previews', () => {
  const content = about.normalizeAboutContent({ about: { missionHeading: 'Mission', heroSubtext: 'Body' } })
  const preview = about.selectAboutPreview(about.resolveAboutContent(content, 'en'))
  assert.deepEqual(preview, { heading: 'Mission', body: 'Body', image: '', stats: [] })
})

/* ══════════════ Content blocks ══════════════ */

test('content blocks are ordered, localized, and dropped when empty', () => {
  const content = about.normalizeAboutContent({
    about: {
      heroHeading: 'About',
      contentBlocks: [
        { heading: { en: 'Second', tr: 'İkinci' }, paragraphs: [{ en: 'Two', tr: 'İki' }, ''], image: 'https://x.com/2.png', imagePosition: 'left', order: 2 },
        { heading: 'First', paragraphs: ['One'], image: 'https://x.com/1.png', imagePosition: 'none', order: 1 },
        { heading: '', paragraphs: ['', { en: '  ' }], image: '', order: 0 },
        { heading: 'Odd position', paragraphs: [], image: 'https://x.com/3.png', imagePosition: 'diagonal', order: 3 },
        { paragraphs: 'not-an-array', image: 'https://x.com/4.png', order: 4 },
        null,
      ],
    },
  })

  const tr = about.resolveAboutContent(content, 'tr')
  assert.deepEqual(tr.contentBlocks, [
    { heading: 'First', paragraphs: ['One'], image: '', imagePosition: 'none' },
    { heading: 'İkinci', paragraphs: ['İki'], image: 'https://x.com/2.png', imagePosition: 'left' },
    { heading: 'Odd position', paragraphs: [], image: 'https://x.com/3.png', imagePosition: 'right' },
    { heading: '', paragraphs: [], image: 'https://x.com/4.png', imagePosition: 'right' },
  ])
})

test('a document with only a content block is still About content', () => {
  const content = about.normalizeAboutContent({ about: { contentBlocks: [{ heading: 'Our values', paragraphs: ['Integrity.'] }] } })
  assert.ok(content)
  assert.equal(about.hasAboutScreenContent(about.resolveAboutContent(content, 'en')), true)
})

/* ══════════════ The Home preview ══════════════ */

test('the preview is one heading, one paragraph, the image and at most four captioned figures', () => {
  const content = about.normalizeAboutContent({
    about: {
      heroHeading: 'About Varlikent',
      heroSubtext: 'Short summary.',
      missionHeading: 'A refined approach.',
      missionParagraph1: 'Long paragraph.',
      missionImage: 'https://x.com/m.png',
      stats: [1, 2, 3, 4, 5].map((n) => ({ value: `${n}+`, label: `Label ${n}`, order: n })),
    },
  })
  const preview = about.selectAboutPreview(about.resolveAboutContent(content, 'en'))

  assert.equal(preview.heading, 'A refined approach.')
  assert.equal(preview.body, 'Short summary.')
  assert.equal(preview.image, 'https://x.com/m.png')
  assert.equal(preview.stats.length, about.ABOUT_PREVIEW_MAX_STATS)
})

test('the preview falls back sensibly and is null when there is nothing to say', () => {
  const headingOnly = about.resolveAboutContent(about.normalizeAboutContent({ about: { heroHeading: 'About' } }), 'en')
  assert.deepEqual(about.selectAboutPreview(headingOnly), { heading: 'About', body: '', image: '', stats: [] })

  const paragraphOnly = about.resolveAboutContent(about.normalizeAboutContent({ about: { missionParagraph1: 'Only text.' } }), 'en')
  assert.deepEqual(about.selectAboutPreview(paragraphOnly), { heading: '', body: 'Only text.', image: '', stats: [] })

  const blocksOnly = about.resolveAboutContent(about.normalizeAboutContent({ about: { contentBlocks: [{ heading: 'Values', paragraphs: [] }] } }), 'en')
  assert.equal(about.selectAboutPreview(blocksOnly), null)
})

test('backend content replaces the bundled fallback in the preview', () => {
  const fallbackPreview = about.selectAboutPreview(about.resolveAboutContent(about.FALLBACK_ABOUT_CONTENT, 'tr'))
  const serverPreview = about.selectAboutPreview(about.resolveAboutContent(about.normalizeAboutContent(TRANSLATED), 'tr'))

  assert.equal(fallbackPreview.heading, 'A refined approach to luxury real estate.')
  assert.equal(serverPreview.heading, 'Rafine bir yaklaşım.')
  assert.equal(serverPreview.body, 'Önde gelen ajans.')
})

/* ══════════════ The bundled fallback ══════════════ */

test('the bundled fallback is the About model defaults: text only, no image, no figures, no team', () => {
  const fallback = about.FALLBACK_ABOUT_CONTENT

  assert.deepEqual(about.normalizeAboutContent(fallback), fallback, 'the fallback is already normalized')
  assert.equal(fallback.missionImage, '')
  assert.deepEqual(fallback.stats, [])
  assert.deepEqual(fallback.contentBlocks, [])
  assert.equal('team' in fallback, false)

  const resolved = about.resolveAboutContent(fallback, 'en')
  assert.equal(resolved.heroHeading, 'About Varlikent')
  assert.equal(resolved.missionParagraphs.length, 2)
  assert.equal(about.hasAboutScreenContent(resolved), true)
})
