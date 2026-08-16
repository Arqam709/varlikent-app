/**
 * VARLIKENT DESIGN TOKENS
 *
 * These are the real brand values, verified against the website's
 * `src/index.css` (`:root` / `html[data-theme="default"]`).
 *
 * ── How this compares to the website ──────────────────────────────────
 * On the React site these live as CSS custom properties (`--vk-green`,
 * `--vk-gold`, ...) plus a Tailwind `@theme` block. The browser resolves
 * them through the cascade, so any element can say `var(--vk-gold)` and
 * inherit from `:root`.
 *
 * React Native has none of that. There is no CSS, no custom properties, no
 * cascade, and no inheritance. The only way to share a value is to export it
 * from a module and `import` it. So this file plays exactly the role that the
 * `:root` block plays on the website — it is the single source of truth — but
 * it is reached by imports rather than by the cascade.
 * ─────────────────────────────────────────────────────────────────────
 */

/**
 * The default "VarliKent Signature" theme.
 *
 * The website ships five themes switched via `html[data-theme="..."]`. We are
 * deliberately shipping only the default one for now. The single extension
 * point is that this object is named and then re-exported as `Colors` below —
 * when we eventually want more themes, `Colors` becomes a lookup into a
 * record of these objects and nothing that consumes it has to change shape.
 */
const varlikentSignature = {
  // ── Greens — the PRIMARY ACTION color ──────────────────────────────
  /** Main brand green. Primary buttons, active states, key actions. */
  brandGreen: '#4b6741',
  /** Lighter green. Secondary surfaces, subtle green fills. */
  green: '#5E7F52',
  /** Deepest green. Pressed/hover state for primary actions. */
  greenDeep: '#3F5A3D',

  // ── Golds — ACCENT / DECORATIVE only ───────────────────────────────
  /** Accent gold. Dividers, ornaments, highlights, prices. NOT buttons. */
  gold: '#C9A35A',
  /** Pressed/hover state for gold elements. */
  goldHover: '#B88D3B',
  /** Warmer gold variant. */
  goldWarm: '#c4993a',

  // ── Neutrals ───────────────────────────────────────────────────────
  /** Deep navy. Admin/dark UI chrome. */
  navy: '#202a36',
  /** Primary dark section background. */
  charcoal: '#1E1E1C',
  /** Alternate dark section background, for banding sections. */
  charcoalAlt: '#2B2B28',
  /** Near-black used specifically by the launch splash. */
  splashBlack: '#080a0e',

  // ── Light surfaces ─────────────────────────────────────────────────
  /** Primary light section background (warm off-white). */
  marble: '#F6F3ED',
  /** Alternate light section background, slightly brighter. */
  softWhite: '#FCFAF6',
  /** Card / elevated surface. */
  cardBg: '#ffffff',
  /** Input backgrounds and the navigation bar. */
  navBg: '#ffffff',

  // ── Text ───────────────────────────────────────────────────────────
  /** Default body text on light surfaces. */
  text: '#1E1E1C',
  /** De-emphasised text: captions, metadata, helper text. */
  textMuted: '#6B6B64',
  /** Text placed on charcoal/green/image backgrounds. */
  textOnDark: '#ffffff',

  // ── Lines ──────────────────────────────────────────────────────────
  /**
   * Hairline borders. React Native accepts `rgba()` strings just like CSS,
   * so this value is copied verbatim from `--vk-border`.
   */
  border: 'rgba(30,30,28,0.10)',

  // ── Semantic aliases ───────────────────────────────────────────────
  /**
   * These do not add new colors — they point at the brand colors above and
   * encode the BRAND RULE so it cannot be broken by accident:
   *
   *     GREEN is the action color.  GOLD is decorative.
   *
   * A component should reach for `primary` when it means "the thing you tap"
   * and `accent` when it means "decoration". That way, if the brand ever
   * shifts, one line changes here instead of fifty lines across the app.
   */
  primary: '#4b6741',
  primaryPressed: '#3F5A3D',
  primaryText: '#ffffff',
  accent: '#C9A35A',
  accentPressed: '#B88D3B',

  /** Default screen background and default elevated surface. */
  background: '#FCFAF6',
  surface: '#ffffff',

  // ── Status ─────────────────────────────────────────────────────────
  /**
   * ⚠️ NOT A VERIFIED VARLIKENT BRAND COLOR.
   *
   * `#B3261E` does not appear anywhere in the website's palette. The website
   * has no defined error color, but mobile forms need one — an invalid-input
   * message rendered in `textMuted` is genuinely hard to notice on a phone.
   *
   * It is therefore a MOBILE-ONLY semantic status color, chosen to sit
   * acceptably beside the brand neutrals. If the website later defines an
   * official error color, replace this value with it.
   */
  danger: '#B3261E',
  /** Verified: same value as `greenDeep`. Reuses the brand green. */
  success: '#3F5A3D',
} as const;

/** The active palette. Import this everywhere: `Colors.brandGreen`, etc. */
export const Colors = varlikentSignature;

/** The shape of a complete Varlikent palette (useful when we add themes). */
export type ThemeColors = typeof varlikentSignature;

/**
 * FONT FAMILIES
 *
 * ⚠️ NOT USABLE YET. These are only the names we will register the fonts
 * under once they are actually loaded. React Native cannot download a font at
 * runtime the way `@import url(...)` does in the browser — the font file must
 * be bundled and loaded before any component references it.
 *
 * Using one of these strings before the font is loaded does not crash, but it
 * silently falls back to the system font, which looks like a styling bug.
 * Do not apply these until the font-loading step is done.
 *
 * The names mirror the PostScript names of the Google Fonts files, because
 * that is what the loader will register.
 *
 * This object lists EXACTLY the six weights we load — no more. Cinzel ships
 * 6 weights and Josefin Sans ships 14, but exposing a name we do not load
 * would let a component silently fall back to the system font. If you need
 * another weight, add it to the loader and to this object together.
 */
export const FontFamily = {
  /** Cinzel — headings, prices, statistics, names, brand/display text. */
  heading: 'Cinzel_400Regular',
  headingSemiBold: 'Cinzel_600SemiBold',
  headingBold: 'Cinzel_700Bold',

  /** Josefin Sans — body, buttons, labels, navigation. The website default. */
  body: 'JosefinSans_400Regular',
  bodyMedium: 'JosefinSans_500Medium',
  bodySemiBold: 'JosefinSans_600SemiBold',
} as const;

/**
 * SPACING SCALE, in density-independent pixels.
 *
 * React Native numbers are unitless: `padding: 16` means 16dp and the OS
 * scales it for the screen density. There is no px / rem / em.
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

/** Corner radii, so buttons, inputs and cards stay consistent. */
export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  /** Pills and circular avatars. */
  full: 999,
} as const;

/** Type scale. Note: `fontWeight` must be a STRING in React Native. */
export const FontSizes = {
  /** Tiny uppercase eyebrow labels. */
  overline: 11,
  xs: 12,
  sm: 14,
  /** Default body size. */
  md: 16,
  lg: 20,
  xl: 28,
  /** Hero / display headings. */
  display: 36,
} as const;

/**
 * LETTER SPACING
 *
 * The Varlikent identity leans on tiny uppercase Josefin Sans labels with wide
 * tracking, sitting above larger Cinzel headings. `wide` exists specifically
 * for that pattern.
 *
 * Unlike CSS `letter-spacing: 0.1em`, React Native's `letterSpacing` is an
 * absolute number in dp, not relative to the font size. So a value that looks
 * right at 11pt will look too tight at 36pt.
 */
export const LetterSpacing = {
  tight: -0.5,
  normal: 0,
  wide: 1.5,
  /** For the small uppercase eyebrow labels. */
  widest: 2.5,
} as const;

/**
 * SHADOWS
 *
 * The website has a single `--vk-shadow: 0 2px 16px rgba(0,0,0,0.08)`.
 * That one CSS line has no direct equivalent here: iOS uses four separate
 * shadow properties, and Android ignores all of them and uses `elevation`.
 * Spreading this object covers both platforms at once.
 */
export const Shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;
