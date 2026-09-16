// The app's bundled palette vs the WEBSITE's built-in defaults.
//
// Nobody has saved a Studio Palette override yet, so `palette: null` is what
// the endpoint really returns and both products render from their own built-in
// table. Those two tables must agree, or the same room looks different on the
// website and in the app for reasons no admin can see or fix.
//
// The website declares the defaults three times — InteriorDesignPage.jsx,
// RenovationPage.jsx and AdminStudioPalette.jsx — so all three are checked.
//
// Cross-repo: skipped when the website is not checked out beside this one, and
// nothing in the app's production code depends on it.

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const WEBSITE = path.resolve(ROOT, '..', 'varlikent', 'frontend', 'src', 'pages')

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

/**
 * The website's `C` theme colours, as the DEFAULT site theme resolves them.
 *
 * Two default materials are CSS custom properties rather than hex literals
 * (`C.gold` → var(--vk-gold), `C.green` → var(--vk-green)). React Native has
 * no CSS variables, so the app pins both to the default theme's values from
 * the website's index.css — which is what this map records.
 */
const THEME_COLORS = { gold: '#C9A35A', green: '#5E7F52' }

/** Reads one `const DEFAULT_X = [...]` array out of a page component. */
const websiteDefaults = (file, name) => {
  const source = fs.readFileSync(file, 'utf8')
  const start = source.indexOf(`const ${name} = [`)
  assert.notEqual(start, -1, `${path.basename(file)} no longer declares ${name}`)

  const open = source.indexOf('[', start)
  const end = source.indexOf('\n]', open)
  assert.notEqual(end, -1, `${path.basename(file)}: could not find the end of ${name}`)

  const literal = source.slice(open, end + 2)
  return new Function('C', `return ${literal}`)(THEME_COLORS)
}

const WEBSITE_FILES = ['InteriorDesignPage.jsx', 'RenovationPage.jsx', 'AdminStudioPalette.jsx']

test('the bundled mobile palette matches the website defaults', (t) => {
  if (!fs.existsSync(WEBSITE)) {
    t.skip('website repository not checked out beside the app')
    return
  }

  const fallback = load('src/features/studio-palette/studio-palette-fallback.ts', {
    '@/features/studio-palette/studio-palette': {},
  })
  const mobile = fallback.fallbackStudioPalette('interior-design')

  for (const name of WEBSITE_FILES) {
    const file = path.join(WEBSITE, name)
    if (!fs.existsSync(file)) {
      t.diagnostic(`${name} is gone from the website; skipping it`)
      continue
    }

    assert.deepEqual(
      websiteDefaults(file, 'DEFAULT_WALL_FINISHES'),
      mobile.wallFinishes.map(({ label, color }) => ({ label, color })),
      `${name}: wall finishes have drifted from the app's bundled defaults`
    )

    assert.deepEqual(
      websiteDefaults(file, 'DEFAULT_FLOOR_FINISHES'),
      mobile.floorFinishes.map(({ label, color }) => ({ label, color })),
      `${name}: floor finishes have drifted`
    )

    assert.deepEqual(
      // Only the name and colour are compared: the two page components declare
      // materials without an image key while the admin screen writes `image: ''`,
      // and "no texture" is the same fact either way.
      websiteDefaults(file, 'DEFAULT_MATERIALS').map(({ name: material, color }) => ({ name: material, color })),
      mobile.materials.map(({ name: material, color }) => ({ name: material, color })),
      `${name}: materials have drifted`
    )
  }
})

test('the Renovation page reads its own palette key, which the app also bundles', (t) => {
  if (!fs.existsSync(WEBSITE)) {
    t.skip('website repository not checked out beside the app')
    return
  }

  const fallback = load('src/features/studio-palette/studio-palette-fallback.ts', {
    '@/features/studio-palette/studio-palette': {},
  })

  // Design My Space uses 'interior-design'. Renovation is bundled too, so the
  // planner can read this layer later without a data change.
  assert.ok(fallback.fallbackStudioPalette('renovation').materials.length > 0)
  assert.deepEqual(
    fallback.fallbackStudioPalette('renovation'),
    fallback.fallbackStudioPalette('interior-design'),
    'the website declares the same defaults for both pages'
  )
})
