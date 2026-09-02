import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

const loadBundle = (code) => {
  const source = read(`src/features/localization/translations/${code}.ts`)
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const require = (id) => { throw new Error(`unexpected import: ${id}`) }
  new Function('exports', 'module', 'require', output)(module.exports, module, require)
  return module.exports[code]
}

const flatten = (value, prefix = '', result = {}) => {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (typeof child === 'string') result[path] = child
    else flatten(child, path, result)
  }
  return result
}

const at = (bundle, key) => key.split('.').reduce((value, part) => value?.[part], bundle)
const codes = ['en', 'tr', 'ar', 'de', 'ru', 'ur']
const bundles = {}

before(() => {
  for (const code of codes) bundles[code] = loadBundle(code)
})

test('Turkish contains no English-identical translatable values', () => {
  const english = flatten(bundles.en)
  const turkish = flatten(bundles.tr)
  const identical = Object.keys(english).filter((key) => english[key] === turkish[key])

  const allowed = new Set([
    'properties.types.villa',
    'account.eyebrow',
    'password.placeholder',
    'appearance.themes.default.label',
    'appearance.themes.classic.label',
    'appearance.themes.dark.label',
    'appearance.themes.light.label',
    'appearance.themes.forest.label',
    'accountInformation.providers.google',
    'accountInformation.providers.microsoft',
    'accountInformation.providers.apple',
    // A vendor brand name, and a dialling format rather than prose. Turkish
    // DOES translate contact.emailPlaceholder, so it is deliberately absent.
    'contact.whatsappLabel',
    'contact.phonePlaceholder',
  ])

  assert.deepEqual(identical.filter((key) => !allowed.has(key)), [])
  assert.deepEqual(identical.sort(), [...allowed].sort(), 'review intentional matches explicitly')
})

test('the physically observed screens render localization keys, not English literals', () => {
  const home = read('src/components/home/home-hero.tsx')
  const properties = read('src/app/(tabs)/properties.tsx')
  const notifications = read('src/app/notifications/index.tsx')
  const alerts = read('src/app/notifications/alerts/index.tsx')

  assert.ok(home.includes("t('home.heroHeadline')"))
  assert.equal(home.includes("We Design, Build{'\\n'}"), false)

  for (const key of ['properties.all', 'properties.buy', 'properties.rent']) {
    assert.ok(properties.includes(`labelKey: '${key}'`), `${key} is not used by the segment`)
  }
  for (const key of [
    'properties.filters',
    'properties.filtersWithCount',
    'properties.count',
  ]) assert.ok(properties.includes(`t('${key}'`), `${key} is not rendered`)
  assert.equal(properties.includes("label: 'All'"), false)
  assert.equal(properties.includes("label: 'Buy'"), false)
  assert.equal(properties.includes("label: 'Rent'"), false)

  assert.ok(notifications.includes("t('notifications.upToDateTitle')"))
  assert.equal(notifications.includes('You&apos;re up to date'), false)

  for (const key of ['alerts.introHeading', 'alerts.emptyDescription', 'alerts.createFirst']) {
    assert.ok(alerts.includes(`t('${key}'`), `${key} is not rendered`)
  }
  assert.equal(alerts.includes('Get notified about the properties you&apos;re actually looking for.'), false)
  assert.equal(alerts.includes('Create an alert and we&apos;ll highlight new listings'), false)
  assert.equal(alerts.includes("'Create Alert'"), false)
})

test('every photographed-screen and controlled-type key resolves in all six bundles', () => {
  const keys = [
    'home.heroHeadline',
    'properties.all',
    'properties.buy',
    'properties.rent',
    'properties.filters',
    'properties.filtersWithCount',
    'properties.count',
    'notifications.upToDateTitle',
    'alerts.introHeading',
    'alerts.emptyDescription',
    'alerts.createFirst',
    ...[
      'apartment', 'villa', 'penthouse', 'duplex', 'studio', 'office',
      'commercial', 'land', 'shop', 'warehouse', 'hotel', 'farm',
    ].map((type) => `properties.types.${type}`),
  ]

  for (const code of codes) {
    for (const key of keys) {
      assert.equal(typeof at(bundles[code], key), 'string', `${code} is missing ${key}`)
    }
  }
})

test('backend-authored property text stays raw while controlled property types are localized', () => {
  const files = [
    'src/components/properties/property-card.tsx',
    'src/components/home/home-featured-properties.tsx',
    'src/app/properties/[id].tsx',
    'src/app/messages/[id].tsx',
  ]

  for (const file of files) {
    const source = read(file)
    for (const forbidden of ['t(property.title', 't(property.description', 't(property.district']) {
      assert.equal(source.includes(forbidden), false, `${file} translates backend-authored data`)
    }
  }

  assert.ok(read('src/components/properties/property-card.tsx').includes('propertyTypeKey(property.propertyType)'))
  assert.ok(read('src/app/properties/[id].tsx').includes('propertyTypeKey(property.propertyType)'))
  assert.ok(read('src/components/properties/property-filter-panel.tsx').includes('propertyTypeKey(type)'))
  assert.ok(read('src/app/notifications/alerts/edit.tsx').includes('propertyTypeKey(type)'))

  const propertiesScreen = read('src/app/(tabs)/properties.tsx')
  assert.equal(/getProperties\(\{[^}]*language/s.test(propertiesScreen), false)
})
