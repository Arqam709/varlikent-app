// Service content PARITY between the website CMS and the app.
//
// The purpose of Phase 3 is that admin-managed service content reaches the
// app. These tests answer, for every service:
//
//   1. Is every backend contract field and section classified — shared, or
//      deliberately website-only? (A new website field fails here until
//      someone decides.)
//   2. Does every SHARED field actually reach rendered data?
//   3. Does the screen render every shared section kind?
//   4. Has the admin-managed body copy left the app's translation bundles?
//
// (1) reads the backend contract from the sibling website repository when it
// is checked out next to this one, and is skipped otherwise.

import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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

const IDS = ['architecture', 'construction', 'renovation', 'interior-design']
const LANGS = ['en', 'tr', 'ar', 'de', 'ru', 'ur']
const BACKEND_REGISTRY = path.resolve(ROOT, '..', 'varlikent', 'backend', 'config', 'pageContentRegistry.js')

let sc
let fallback
const bundles = {}

before(() => {
  const localized = load('src/features/localization/localized-content.ts')
  fallback = load('src/features/services/service-content-fallback.ts').SERVICE_CONTENT_FALLBACK
  sc = load('src/features/services/service-content.ts', {
    '@/features/localization/localized-content': localized,
    '@/features/services/service-content-fallback': { SERVICE_CONTENT_FALLBACK: fallback },
  })
  for (const lang of LANGS) bundles[lang] = load(`src/features/localization/translations/${lang}.ts`, { './en': {} })[lang]
})

/* ══════════════ 1. Every backend field and section is classified ══════════════ */

test('every backend contract field and section is classified for every service', async (t) => {
  if (!fs.existsSync(BACKEND_REGISTRY)) {
    t.skip('website repository not checked out beside the app')
    return
  }
  const { PAGE_CONTENT_CONTRACT } = await import(pathToFileURL(BACKEND_REGISTRY).href)

  for (const id of IDS) {
    const map = sc.SERVICE_PAGES[id]
    const contract = PAGE_CONTENT_CONTRACT[map.pageKey]
    assert.ok(contract, `no backend page '${map.pageKey}'`)

    const classifiedFields = [...map.sharedFields, ...map.websiteOnly.fields].sort()
    assert.deepEqual(classifiedFields, Object.keys(contract.fields).sort(),
      `${id}: backend fields and the app's classification differ — classify the new field as shared or website-only`)
    assert.equal(new Set(classifiedFields).size, classifiedFields.length, `${id}: a field is classified twice`)

    assert.deepEqual([...map.sections, ...map.websiteOnly.sections].sort(), [...contract.sections].sort(), `${id}: sections differ`)
    assert.deepEqual([...map.sections], contract.sections.filter((section) => map.sections.includes(section)),
      `${id}: rendered sections must follow the backend (website) order`)

    for (const field of map.bundledFields) {
      assert.equal(field in contract.fields, false, `${id}.${field} is a CMS field and must not be app-bundled`)
    }
    for (const field of map.sharedFields) {
      assert.equal(contract.fields[field], 'text', `${id}.${field} is not a text field on the backend`)
    }
  }
})

/* ══════════════ 2. Every shared field reaches rendered data ══════════════ */

test('every shared field, when saved by an admin, appears in the resolved page', () => {
  for (const id of IDS) {
    const map = sc.SERVICE_PAGES[id]
    const fields = Object.fromEntries(map.sharedFields.map((field) => [field, { type: 'text', sourceLang: 'en', en: `MARK:${field}` }]))
    const page = sc.resolveServicePage(id, sc.normalizeServiceContent(id, { fields, sections: {} }), 'en')
    const rendered = JSON.stringify(page)

    for (const field of map.sharedFields) {
      assert.ok(rendered.includes(`MARK:${field}`), `${id}.${field} is classified shared but never rendered`)
    }
  }
})

/* ══════════════ 3. The screen renders every shared section kind ══════════════ */

const SCREEN = 'src/app/services/[service].tsx'

test('the service screen renders every section kind any service shares', () => {
  const screen = read(SCREEN)
  const kinds = new Set(IDS.flatMap((id) => sc.SERVICE_PAGES[id].sections))
  for (const kind of kinds) assert.ok(screen.includes(`case '${kind}':`), `the screen does not render '${kind}'`)
})

test('the screen reads the shared content source per service and per language', () => {
  const screen = read(SCREEN)
  assert.ok(screen.includes('useServiceContent(service?.id)'))
  assert.ok(screen.includes('resolveServicePage(service.id, content, language)'))
  assert.ok(screen.includes('[service, content, language]'))
  assert.ok(screen.includes('showroom.enabled === true && gallery.length > 0'), 'a disabled or empty gallery would render')
  assert.ok(screen.includes('onError={() => setFailed('), 'a failed gallery image would leave a broken frame')
  assert.equal(/t\(serviceKey\(service, '(websiteLabel|caps|process|comparison|note|ctaLabel|closing)/.test(screen), false,
    'the screen still reads service body copy from translations')
})

test('the Contact CTAs still send the service’s stable Contact interest id', () => {
  const screen = read(SCREEN)
  assert.ok(/router\.push\(\{\s*pathname: '\/contact',\s*params: \{ interestType: service\.contactInterestId \},?\s*\}\)/.test(screen))
  assert.equal((screen.match(/onPress=\{openContact\}/g) ?? []).length, 1, 'the closing CTA')
  assert.ok(screen.includes('onContact={openContact}'), 'the hero CTA')
})

test('the screen follows reading direction and theme tokens', () => {
  const screen = read(SCREEN)
  assert.ok((screen.match(/useDirection\(\)/g) ?? []).length >= 5)
  assert.ok(screen.includes('inverted={isRTL}'), 'the gallery must start at the reading edge in RTL')
  assert.ok(screen.includes('useThemedStyles(makeStyles)'))
  assert.equal(/#[0-9a-fA-F]{3,8}\b/.test(screen), false, 'hardcoded colour on the service screen')
})

/* ══════════════ 4. Admin-managed body copy left the translation bundles ══════════════ */

test('translation bundles keep only navigation copy for services', () => {
  for (const lang of LANGS) {
    const services = bundles[lang].services
    for (const [key, item] of Object.entries(services.items)) {
      assert.deepEqual(Object.keys(item).sort(), ['description', 'short', 'title'], `${lang}.services.items.${key}`)
    }
    assert.equal('howWeWork' in services, false)
    assert.equal('theTransformation' in services, false)
  }
})

test('no bundled service body text is duplicated in any translation bundle', () => {
  const flatten = (value, out = []) => {
    for (const child of Object.values(value)) typeof child === 'string' ? out.push(child) : flatten(child, out)
    return out
  }
  // title and description stay as navigation copy (Home tiles, the Services list).
  const NAVIGATION_DUPLICATES = new Set(['heroHeading', 'heroSubtitle'])

  for (const lang of LANGS) {
    const strings = new Set(flatten(bundles[lang]))
    for (const id of IDS) {
      for (const [field, value] of Object.entries(fallback[id])) {
        if (NAVIGATION_DUPLICATES.has(field)) continue
        const text = value[lang]
        if (text && text.length >= 30) assert.equal(strings.has(text), false, `${lang} bundle still carries ${id}.${field}`)
      }
    }
  }
})

test('Home and the Services list stay lightweight: no page-content requests', () => {
  for (const file of ['src/components/home/home-services-preview.tsx', 'src/app/services/index.tsx', 'src/app/(tabs)/index.tsx']) {
    const source = read(file)
    assert.equal(/useServiceContent|refreshServiceContent|fetchServiceContent|useServiceShowroom/.test(source), false, `${file} loads service content`)
  }
})
