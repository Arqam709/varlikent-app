// The public Home language selector (Phase 10D).
//
// This control exists for one person: someone looking at Varlikent in a
// language they cannot read. Everything below protects that — the globe must be
// reachable without signing in, the options must be spelled the way that person
// would recognise them, and choosing one must go through the same setLanguage
// that Account uses so Phase 10C records it as a deliberate choice.
//
// The REAL component runs. React, React Native primitives and the theme are
// stubbed, and the returned element tree is walked so presses can actually be
// simulated — no testing library is installed.

import test, { before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8')

/* ── Element tree ────────────────────────────────────────────────────── */

const jsx = (type, props, ...children) => ({
  type,
  props: props ?? {},
  children: children.flat(Infinity).filter((c) => c != null && c !== false),
})

/** Every node in the tree, depth first. */
const walk = (node, out = []) => {
  if (!node || typeof node !== 'object') return out
  out.push(node)
  for (const child of node.children ?? []) walk(child, out)
  return out
}

const findByLabel = (tree, label) =>
  walk(tree).find((n) => n.props?.accessibilityLabel === label)

const findByType = (tree, type) => walk(tree).filter((n) => n.type === type)

/**
 * A node's styles, flattened.
 *
 * Pressable takes a FUNCTION for style, so it is invoked in the unpressed
 * state — otherwise the resting appearance is invisible to these tests.
 */
const stylesOf = (node) => {
  const raw = node.props?.style
  const resolved = typeof raw === 'function' ? raw({ pressed: false }) : raw
  return [resolved].flat(Infinity).filter((s) => s && typeof s === 'object')
}

/** The visible strings, in render order. */
const textsOf = (tree) =>
  walk(tree)
    .filter((n) => n.type === 'Text')
    .flatMap((n) => n.children.filter((c) => typeof c === 'string'))

/* ── Hooks ───────────────────────────────────────────────────────────── */

let slots = []
let cursor = 0

const React = {
  Fragment: 'Fragment',
  useState(initial) {
    const i = cursor++
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial
    return [slots[i], (next) => { slots[i] = typeof next === 'function' ? next(slots[i]) : next }]
  },
}

/* ── Scripted context ────────────────────────────────────────────────── */

let language = 'en'
let isRTL = false
let setLanguageCalls = []

/**
 * A real lookup against the real English bundle.
 *
 * Deliberately not a stub returning the key: the trigger's label depends on the
 * bundle actually containing a {language} placeholder, and a stub would hide a
 * missing one.
 */
let enBundle = {}
const t = (key, vars) => {
  const value = key.split('.').reduce((o, part) => o?.[part], enBundle) ?? key
  if (!vars) return value
  return Object.entries(vars).reduce((s, [k, v]) => s.split(`{${k}}`).join(v), value)
}

let LANGUAGES
let getLanguageMeta
let palette
let Picker

before(() => {
  /*
   * The REAL registry, loaded from the real provider. Nothing about the option
   * list is restated here — that duplication is exactly what these tests exist
   * to forbid.
   */
  enBundle = load('src/features/localization/translations/en.ts').en

  const languageModule = loadReal()
  LANGUAGES = languageModule.LANGUAGES
  getLanguageMeta = languageModule.getLanguageMeta

  // Dark Luxury: the only isDark palette, and the harshest readability case.
  const constants = load('src/constants/theme.ts')
  const themes = load('src/features/theme/themes.ts', { '@/constants/theme': constants })
  palette = themes.THEMES.dark

  Picker = load(
    'src/components/home/home-language-picker.tsx',
    {
      react: React,
      'react-native': {
        Modal: 'Modal',
        Pressable: 'Pressable',
        Text: 'Text',
        View: 'View',
        StyleSheet: {
          create: (s) => s,
          absoluteFillObject: {},
          hairlineWidth: 1,
        },
      },
      'react-native-safe-area-context': {
        useSafeAreaInsets: () => ({ top: 24, bottom: 34, left: 0, right: 0 }),
      },
      // A default import, so transpiled code reaches for `.default`.
      '@expo/vector-icons/Ionicons': { default: 'Ionicons' },
      '@/constants/theme': constants,
      '@/features/localization/language-context': {
        LANGUAGES,
        getLanguageMeta,
        useLanguage: () => ({
          t,
          language,
          isRTL,
          setLanguage: async (code) => { setLanguageCalls.push(code) },
        }),
      },
      '@/features/theme/theme-context': { useTheme: () => ({ theme: palette }) },
      '@/features/theme/use-themed-styles': { useThemedStyles: (fn) => fn(palette) },
      '@/features/theme/themes': {},
    },
    true
  ).default
})

function load(relative, imports = {}, useJsx = false) {
  const { outputText } = ts.transpileModule(read(relative), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(useJsx ? { jsx: ts.JsxEmit.React, jsxFactory: '__jsx' } : {}),
    },
  })
  const module = { exports: {} }
  const require = (id) => {
    if (id in imports) return imports[id]
    throw new Error(`unexpected import: ${id}`)
  }
  // React is passed in because a fragment compiles to React.Fragment, and the
  // component imports only { useState } — so TS emits no React binding.
  new Function('exports', 'module', 'require', '__jsx', 'React', outputText)(
    module.exports,
    module,
    require,
    jsx,
    React
  )
  return module.exports
}

/** The real provider, wired to stubs, purely to obtain the real registry. */
function loadReal() {
  const noopStorage = {
    readStoredLanguage: async () => null,
    readStoredLanguageSource: async () => null,
    readStoredTheme: async () => null,
    writeStoredLanguage: async () => {},
    writeStoredLanguageSource: async () => {},
  }
  return load(
    'src/features/localization/language-context.tsx',
    {
      react: {
        createContext: () => ({ Provider: 'Provider' }),
        useState: () => [null, () => {}],
        useEffect: () => {},
        useCallback: (f) => f,
        useMemo: (f) => f(),
        useContext: () => null,
      },
      'react-native': { I18nManager: { allowRTL: () => {}, isRTL: false, forceRTL: () => {} } },
      './language-bootstrap': { resolveInitialLanguage: async () => ({ language: 'en', source: 'device' }) },
      '@/features/preferences/preferences-storage': noopStorage,
      './translations/en': load('src/features/localization/translations/en.ts'),
      './translations/tr': load('src/features/localization/translations/tr.ts'),
      './translations/ar': load('src/features/localization/translations/ar.ts'),
      './translations/ru': load('src/features/localization/translations/ru.ts'),
      './translations/de': load('src/features/localization/translations/de.ts'),
    },
    true
  )
}

beforeEach(() => {
  slots = []
  language = 'en'
  isRTL = false
  setLanguageCalls = []
})

const render = () => {
  cursor = 0
  return Picker({})
}

/** The sheet's Modal node. */
const modalOf = (tree) => findByType(tree, 'Modal')[0]

const openSheet = () => {
  let tree = render()
  const trigger = walk(tree).find((n) => n.type === 'Pressable' && n.props.onPress)
  trigger.props.onPress()
  return render()
}

/* ═══════════════ The trigger ═══════════════ */

test('1. Home renders the picker, outside any auth check', () => {
  const home = read('src/app/(tabs)/index.tsx')

  assert.ok(home.includes('<HomeLanguagePicker />'), 'the trigger must be on Home')

  // It must not sit inside a signed-in branch.
  const beforeTrigger = home.slice(0, home.indexOf('<HomeLanguagePicker />'))
  const opens = (beforeTrigger.match(/status === 'authenticated'|token \?|user \?/g) ?? []).length
  assert.equal(opens, 0, 'the picker is inside an authenticated-only branch')
})

test('2. the picker itself never consults auth', () => {
  const source = read('src/components/home/home-language-picker.tsx')

  for (const forbidden of ['useAuth', 'auth-context', 'token', 'isAuthenticated']) {
    assert.equal(source.includes(forbidden), false, `must not reference ${forbidden}`)
  }
})

test('3. the trigger shows a globe and the current language code', () => {
  for (const [code, expected] of [['en', 'EN'], ['tr', 'TR'], ['ar', 'AR'], ['de', 'DE'], ['ru', 'RU']]) {
    slots = []
    language = code

    const tree = render()

    assert.ok(
      findByType(tree, 'Ionicons').some((n) => n.props.name === 'globe-outline'),
      'globe-outline missing'
    )
    assert.ok(textsOf(tree).includes(expected), `expected ${expected} for ${code}`)
  }
})

test('4. no country flags are used — language is not country', () => {
  const source = read('src/components/home/home-language-picker.tsx')
  assert.equal(/[\u{1F1E6}-\u{1F1FF}]/u.test(source), false, 'flag emoji found')
})

test('5. the code is derived, not a second mapping table', () => {
  const source = read('src/components/home/home-language-picker.tsx')

  assert.ok(source.includes('language.toUpperCase()'))
  assert.equal(/SHORT_CODES|CODE_LABELS/.test(source), false, 'duplicate mapping table')
})

test('6. the trigger carries a localized label naming the current language', () => {
  language = 'tr'
  const tree = render()

  const trigger = walk(tree).find(
    (n) => typeof n.props?.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Change language')
  )

  assert.ok(trigger, 'no localized trigger label')
  assert.ok(trigger.props.accessibilityLabel.includes('Türkçe'), 'current language not announced')
  assert.equal(trigger.props.accessibilityRole, 'button')
})

/* ═══════════════ The sheet ═══════════════ */

test('7. the sheet is closed until the trigger is pressed', () => {
  assert.equal(modalOf(render()).props.visible, false)
  assert.equal(modalOf(openSheet()).props.visible, true)
})

test('8. Android back is wired and closes the sheet', () => {
  const tree = openSheet()
  const modal = modalOf(tree)

  assert.equal(typeof modal.props.onRequestClose, 'function')
  modal.props.onRequestClose()

  assert.equal(modalOf(render()).props.visible, false)
})

test('9. the backdrop closes the sheet', () => {
  const tree = openSheet()
  const backdrop = findByLabel(tree, 'Close')

  assert.ok(backdrop, 'no dismissible backdrop')
  backdrop.props.onPress()

  assert.equal(modalOf(render()).props.visible, false)
})

test('10. the close button closes the sheet', () => {
  const tree = openSheet()
  // Two nodes share the close label: the backdrop and the button. The button
  // is the one carrying the icon.
  const closers = walk(tree).filter((n) => n.props?.accessibilityLabel === 'Close')

  assert.equal(closers.length, 2, 'expected a backdrop and a close button')
  closers[1].props.onPress()

  assert.equal(modalOf(render()).props.visible, false)
})

test('11. the sheet title is localized and reuses the existing key', () => {
  // 'Language' is the existing language.title value, reused rather than duplicated.
  assert.ok(textsOf(openSheet()).includes('Language'), 'title must come from language.title')
  assert.ok(read('src/components/home/home-language-picker.tsx').includes("t('language.title')"))

  const source = read('src/components/home/home-language-picker.tsx')
  assert.equal(/chooseLanguage|language\.choose/.test(source), false, 'duplicate title key')
})

test('12. the sheet clears the bottom safe area', () => {
  const sheet = walk(openSheet()).find((n) =>
    stylesOf(n).some((st) => st.paddingBottom)
  )

  const padding = stylesOf(sheet).find((st) => st.paddingBottom).paddingBottom
  assert.ok(padding > 34, `expected inset 34 plus spacing, got ${padding}`)
})

/* ═══════════════ Options come from the registry ═══════════════ */

test('13. the visible names are the languages own, in registry order', () => {
  const texts = textsOf(openSheet())

  assert.deepEqual(
    texts.filter((s) => ['English', 'Türkçe', 'العربية', 'Deutsch', 'Русский'].includes(s)),
    ['English', 'Türkçe', 'العربية', 'Deutsch', 'Русский']
  )

  // Never the English names of other languages.
  for (const wrong of ['Turkish', 'Arabic']) {
    assert.equal(texts.includes(wrong), false, `${wrong} must not be the visible label`)
  }
})

test('14. self-names do not change with the UI language', () => {
  for (const code of ['en', 'tr', 'ar', 'de', 'ru']) {
    slots = []
    language = code
    isRTL = code === 'ar'

    const texts = textsOf(openSheet())

    for (const name of ['English', 'Türkçe', 'العربية', 'Deutsch', 'Русский']) {
      assert.ok(texts.includes(name), `${name} missing while UI is ${code}`)
    }
  }
})

test('15. the option list is driven by LANGUAGES, not a copy', () => {
  // Behavioural proof: a language added to the registry appears in the sheet.
  LANGUAGES.push({ code: 'zz', label: 'Testish', englishLabel: 'Testish', rtl: false })

  try {
    slots = []
    assert.ok(textsOf(openSheet()).includes('Testish'), 'the sheet ignored the registry')
  } finally {
    LANGUAGES.pop()
  }

  const source = read('src/components/home/home-language-picker.tsx')
  assert.ok(source.includes('LANGUAGES.map'))
  assert.equal(/'en'\s*,\s*'tr'\s*,\s*'ar'/.test(source), false, 'inline language list')
  assert.equal(source.includes("code: 'de'"), false, 'German must come from LANGUAGES')
  assert.equal(source.includes('Deutsch'), false, 'German row must not be hard-coded')
  assert.equal(source.includes("code: 'ru'"), false, 'Russian must come from LANGUAGES')
  assert.equal(source.includes('Русский'), false, 'Russian row must not be hard-coded')
})

test('16. the registry is never reversed for RTL', () => {
  isRTL = true
  language = 'ar'

  const texts = textsOf(openSheet()).filter((s) =>
    ['English', 'Türkçe', 'العربية', 'Deutsch', 'Русский'].includes(s)
  )

  assert.deepEqual(texts, ['English', 'Türkçe', 'العربية', 'Deutsch', 'Русский'], 'layout mirrors, data does not')

  const source = read('src/components/home/home-language-picker.tsx')
  assert.equal(source.includes('.reverse()'), false)
})

/* ═══════════════ Selection ═══════════════ */

test('17. the selected language is marked, and only that one', () => {
  for (const [code, expected] of [['en', 'English'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['de', 'Deutsch'], ['ru', 'Русский']]) {
    slots = []
    language = code

    const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')
    const selected = rows.filter((r) => r.props.accessibilityState?.selected)

    assert.equal(selected.length, 1, `${code}: exactly one row may be selected`)
    assert.ok(
      textsOf(selected[0]).includes(expected),
      `${code}: the wrong row is marked`
    )
  }
})

test('18. rows expose radio semantics', () => {
  language = 'tr'
  const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')

  assert.equal(rows.length, LANGUAGES.length)
  for (const row of rows) {
    assert.equal(typeof row.props.accessibilityState?.selected, 'boolean')
    // The English name, so a screen reader can pronounce it.
    assert.ok(
      LANGUAGES.some((l) => l.englishLabel === row.props.accessibilityLabel),
      'row label is not an englishLabel'
    )
  }
})

test('19. choosing a language calls the shared setLanguage', () => {
  const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')
  rows[1].props.onPress()

  assert.deepEqual(setLanguageCalls, ['tr'])
})

test('19c. the Russian row can be pressed through the shared setter', () => {
  const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')
  const russian = rows.find((row) => row.props.accessibilityLabel === 'Russian')

  assert.ok(russian, 'Русский must be offered')
  // Visible in its own script; announced in English so a screen reader can say it.
  assert.ok(textsOf(russian).includes('Русский'))

  russian.props.onPress()
  assert.deepEqual(setLanguageCalls, ['ru'])
})

test('19d. the sheet closes after choosing Russian', () => {
  const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')
  rows.find((row) => row.props.accessibilityLabel === 'Russian').props.onPress()

  assert.equal(modalOf(render()).props.visible, false)
})

test('19b. the German row can be pressed through the shared setter', () => {
  const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')
  const german = rows.find((row) => row.props.accessibilityLabel === 'German')

  german.props.onPress()
  assert.deepEqual(setLanguageCalls, ['de'])
})

test('20. choosing closes the sheet', () => {
  const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')
  rows[2].props.onPress()

  assert.equal(modalOf(render()).props.visible, false)
})

test('21. re-picking the current language still records an explicit choice', () => {
  language = 'en'
  const rows = walk(openSheet()).filter((n) => n.props?.accessibilityRole === 'radio')
  rows[0].props.onPress()

  // Phase 10C turns this into source = 'user', which is the whole point: the
  // customer said "yes, English", so the phone's locale is never consulted again.
  assert.deepEqual(setLanguageCalls, ['en'])
})

test('22. the picker performs NO storage writes of its own', () => {
  const source = read('src/components/home/home-language-picker.tsx')

  for (const forbidden of [
    'AsyncStorage',
    'writeStoredLanguage',
    'writeStoredLanguageSource',
    'preferences-storage',
    'language-bootstrap',
    'device-locale',
  ]) {
    assert.equal(source.includes(forbidden), false, `must not touch ${forbidden}`)
  }
})

/* ═══════════════ Direction and theme ═══════════════ */

test('23. direction comes from isRTL, never from a language comparison', () => {
  const source = read('src/components/home/home-language-picker.tsx')

  assert.ok(source.includes('isRTL'))
  assert.equal(/language\s*===\s*'ar'/.test(source), false, 'do not re-derive direction')
})

test('24. rows and header mirror when isRTL is true', () => {
  isRTL = true
  const withRtl = walk(openSheet()).filter((n) =>
    stylesOf(n).some((st) => st.flexDirection === 'row-reverse')
  )

  slots = []
  isRTL = false
  const withoutRtl = walk(openSheet()).filter((n) =>
    stylesOf(n).some((st) => st.flexDirection === 'row-reverse')
  )

  assert.ok(withRtl.length > 0, 'nothing mirrored in RTL')
  assert.equal(withoutRtl.length, 0, 'mirrored while LTR')
})

test('25. colours come from theme tokens, not hard-coded black or white', () => {
  const source = read('src/components/home/home-language-picker.tsx')
  const styles = source.slice(source.indexOf('const makeStyles'))

  assert.equal(/'#fff'|'#ffffff'|'white'|'#000'|'black'/i.test(styles), false)

  // The one literal is the backdrop scrim, matching the existing filter sheet.
  assert.ok(styles.includes('rgba(30,30,28,0.45)'))
})

test('26. every themed colour resolves under Dark Luxury', () => {
  // palette is THEMES.dark, so a missing token would surface as undefined here.
  const tree = openSheet()

  for (const node of walk(tree)) {
    for (const style of stylesOf(node)) {
      for (const [key, value] of Object.entries(style)) {
        if (/color/i.test(key)) {
          assert.notEqual(value, undefined, `${key} is undefined under Dark Luxury`)
        }
      }
    }
  }

  const icons = findByType(tree, 'Ionicons')
  for (const icon of icons) {
    assert.notEqual(icon.props.color, undefined, `${icon.props.name} has no colour`)
  }
})
