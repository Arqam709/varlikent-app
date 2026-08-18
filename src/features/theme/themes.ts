import { Colors, type ThemeColors } from '@/constants/theme';

/**
 * THE FIVE VARLIKENT THEMES, AS MOBILE PALETTES
 *
 * ── Where these values come from ────────────────────────────────────────
 * The website defines each theme as a block of CSS custom properties in
 * `frontend/src/index.css` (`html[data-theme="default"]` … `="forest"`). Those
 * were read directly; this is not a reinterpretation of the brand. The mapping
 * from CSS variable to mobile token is:
 *
 *   --vk-green-brand      → brandGreen / primary
 *   --vk-green-deep       → greenDeep / primaryPressed
 *   --vk-gold             → gold / accent
 *   --vk-section-dark     → charcoal
 *   --vk-section-light    → marble
 *   --vk-card-bg          → surface / cardBg
 *   --vk-text             → text
 *   --vk-text-muted       → textMuted
 *   --vk-border           → border
 *   --t-bg                → background
 *
 * ── Where mobile deliberately DIVERGES ──────────────────────────────────
 * Three kinds of value are adjusted rather than copied, and each is marked
 * inline below:
 *
 *   1. `textMuted` on Heritage Navy. The website uses #9CA3AF, which sits at
 *      roughly 2.3:1 on white — acceptable for a desktop caption beside plenty
 *      of other cues, genuinely hard to read on a phone in daylight. Mobile
 *      darkens it.
 *   2. `danger`. The website defines no error colour at all (see the note in
 *      constants/theme.ts), so the mobile-only #B3261E is used — lightened on
 *      the dark theme, where it would otherwise be near-invisible.
 *   3. `primaryText`. On dark themes pure white is harsher than the theme's own
 *      warm off-white, so it follows `textOnDark`.
 *
 * ── Why not just import the website's CSS ────────────────────────────────
 * There is nothing to import. React Native has no CSS, no custom properties and
 * no cascade, so a palette must be a plain object reached by `import`. That is
 * exactly the role constants/theme.ts already plays for the default theme, and
 * this file extends it the way that file's own comment anticipated: "when we
 * eventually want more themes, Colors becomes a lookup into a record of these
 * objects and nothing that consumes it has to change shape."
 */

/**
 * A complete palette.
 *
 * Widened from `ThemeColors`, which is `typeof varlikentSignature` on an
 * `as const` object and therefore has LITERAL types ('#4b6741', not string).
 * Every palette has the same keys but different values, so the literal form
 * cannot describe them — this maps the same key set onto plain strings. Using
 * `keyof ThemeColors` rather than restating the keys means a token added to
 * constants/theme.ts becomes a compile error in all five themes at once.
 */
export type ThemePalette = { [K in keyof ThemeColors]: string };

export type ThemeId = 'default' | 'classic' | 'dark' | 'light' | 'forest';

/** Ordered exactly as the website's Appearance section lists them. */
export const THEME_IDS: ThemeId[] = ['default', 'classic', 'dark', 'light', 'forest'];

/**
 * Varlikent Signature — the default, and the palette already shipped in
 * constants/theme.ts. Spread rather than restated so the two cannot drift.
 */
const signature: ThemePalette = { ...Colors };

/** Heritage Navy — deep navy & cream with gold accents. */
const heritageNavy: ThemePalette = {
  ...Colors,
  brandGreen: '#4D6B45',
  green: '#4D6B45',
  greenDeep: '#3A5030',
  gold: '#C9A35A',
  goldHover: '#B48A35',
  goldWarm: '#B48A35',
  navy: '#101B2D',
  charcoal: '#101B2D',
  charcoalAlt: '#07111F',
  marble: '#F6F0E6',
  softWhite: '#EEE8DC',
  cardBg: '#ffffff',
  navBg: '#101B2D',
  // Content on the navy bar. The deep brand green measured 2.88:1 there, so
  // the active state uses a lifted green and the inactive a cool light grey.
  primaryInk: '#4D6B45',
  navActive: '#9CBE8C',
  navInactive: '#A3ADBB',
  accentText: '#7A5E1E',
  text: '#111111',
  // DIVERGENCE (1): website #9CA3AF is too light for phone body text.
  textMuted: '#5C6470',
  textOnDark: '#F7F3EA',
  border: 'rgba(16,27,45,0.12)',
  primary: '#4D6B45',
  primaryPressed: '#3A5030',
  primaryText: '#ffffff',
  accent: '#C9A35A',
  accentPressed: '#B48A35',
  background: '#EEE8DC',
  surface: '#ffffff',
  success: '#3A5030',
};

/** Dark Luxury — obsidian backgrounds with warm gold. The only dark palette. */
const darkLuxury: ThemePalette = {
  ...Colors,
  brandGreen: '#5E7F52',
  green: '#5E7F52',
  greenDeep: '#2F4733',
  gold: '#D1A85B',
  goldHover: '#B88D40',
  goldWarm: '#B88D40',
  navy: '#0E1110',
  charcoal: '#0E1110',
  charcoalAlt: '#181C1A',
  marble: '#202622',
  softWhite: '#181C1A',
  cardBg: '#202622',
  navBg: '#0E1110',
  // Lifted so icons and the selected-radio outline stay visible on the
  // #202622 card; `primary` stays deep for readable button labels.
  primaryInk: '#9CBE8C',
  navActive: '#9CBE8C',
  navInactive: '#B6B0A6',
  // Gold reads well on the obsidian surfaces, so text gold needs no darkening.
  accentText: '#D1A85B',
  text: '#F6F1E8',
  textMuted: '#B6B0A6',
  textOnDark: '#F6F1E8',
  border: 'rgba(209,168,91,0.18)',
  // Deepened until the warm off-white label clears 4.5:1 on it — the previous
  // #5E7F52 measured 4.03:1, which is below the bar for normal text. The tab
  // bar is unaffected: its active state is `navActive`, a separate token.
  primary: '#4A6B42',
  primaryPressed: '#3F5A3D',
  // DIVERGENCE (3): the theme's warm off-white, not pure white.
  primaryText: '#F6F1E8',
  accent: '#D1A85B',
  accentPressed: '#B88D40',
  background: '#181C1A',
  surface: '#202622',
  // DIVERGENCE (2): #B3261E is unreadable on a near-black ground.
  danger: '#E5827A',
  success: '#8FB37E',
};

/** Light Luxury — warm ivory & forest green. */
const lightLuxury: ThemePalette = {
  ...Colors,
  brandGreen: '#4D6B45',
  green: '#4D6B45',
  greenDeep: '#314B35',
  gold: '#C4A15A',
  goldHover: '#A8882E',
  goldWarm: '#A8882E',
  charcoal: '#314B35',
  charcoalAlt: '#243825',
  marble: '#FBF8F1',
  softWhite: '#F3EEE4',
  cardBg: '#ffffff',
  navBg: '#ffffff',
  primaryInk: '#4D6B45',
  navActive: '#4D6B45',
  navInactive: '#676D65',
  accentText: '#856317',
  text: '#111827',
  textMuted: '#676D65',
  textOnDark: '#F7F3EA',
  border: '#E5DED2',
  primary: '#4D6B45',
  primaryPressed: '#314B35',
  primaryText: '#ffffff',
  accent: '#C4A15A',
  accentPressed: '#A8882E',
  background: '#F3EEE4',
  surface: '#ffffff',
  success: '#314B35',
};

/** Forest Green — rich forest greens with cream & gold. */
const forestGreen: ThemePalette = {
  ...Colors,
  brandGreen: '#4D6B45',
  green: '#3F5A3D',
  greenDeep: '#263D2C',
  gold: '#C9A35A',
  goldHover: '#B48A35',
  goldWarm: '#B48A35',
  charcoal: '#263D2C',
  charcoalAlt: '#1A2E1E',
  marble: '#EEF3EA',
  softWhite: '#E4ECDF',
  cardBg: '#F8F4EA',
  navBg: '#263D2C',
  primaryInk: '#4D6B45',
  navActive: '#B9D6A8',
  navInactive: '#AFC4A9',
  accentText: '#7A5E1E',
  text: '#142018',
  textMuted: '#4A6050',
  textOnDark: '#F7F3EA',
  border: 'rgba(38,61,44,0.15)',
  primary: '#4D6B45',
  primaryPressed: '#263D2C',
  primaryText: '#ffffff',
  accent: '#C9A35A',
  accentPressed: '#B48A35',
  background: '#E4ECDF',
  surface: '#F8F4EA',
  success: '#263D2C',
};

export const THEMES: Record<ThemeId, ThemePalette> = {
  default: signature,
  classic: heritageNavy,
  dark: darkLuxury,
  light: lightLuxury,
  forest: forestGreen,
};

/**
 * Presentation metadata for the Appearance screen.
 *
 * Labels and descriptions are NOT here — they live in the translation bundles,
 * because they are user-facing copy that has to appear in Turkish and Arabic.
 * This holds only what cannot be translated: the swatch colours, and whether
 * the palette is dark (which drives the status-bar icon colour).
 */
export const THEME_META: Record<ThemeId, { swatch: [string, string, string]; isDark: boolean }> = {
  default: { swatch: ['#1E1E1C', '#F6F3ED', '#C9A35A'], isDark: false },
  classic: { swatch: ['#101B2D', '#F6F0E6', '#C9A35A'], isDark: false },
  dark: { swatch: ['#0E1110', '#202622', '#D1A85B'], isDark: true },
  light: { swatch: ['#314B35', '#FBF8F1', '#C4A15A'], isDark: false },
  forest: { swatch: ['#263D2C', '#EEF3EA', '#C9A35A'], isDark: false },
};

/** Narrows an arbitrary string (stored preference, server value) to a ThemeId. */
export function toThemeId(value: unknown): ThemeId | null {
  return typeof value === 'string' && (THEME_IDS as string[]).includes(value)
    ? (value as ThemeId)
    : null;
}
