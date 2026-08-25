import { toThemeId, type ThemeId } from './themes';

/**
 * THE SHARED THEME VOCABULARY
 *
 * ── The problem this file exists to solve ───────────────────────────────
 * Mobile and the website do not name themes the same way, and for a while they
 * did not agree at all. Mobile stores its own five ids; the website and backend
 * settled on eight canonical ones. `PUT /users/me/theme` validates against the
 * canonical eight and returns 400 for anything else — so mobile sending
 * `classic`, `dark` or `light` was silently rejected on every sync, and the
 * account mirror had been quietly broken since the website's theme rewrite.
 *
 * Rather than widen the backend to accept both vocabularies (which would leave
 * two competing spellings permanently in `User.themePreference`), this module
 * translates at the boundary. The canonical eight are the shared language; the
 * local five are a mobile implementation detail that never leaves the device.
 *
 * ── The one rule ────────────────────────────────────────────────────────
 * NEVER send an id whose palette does not actually resemble what the customer
 * is looking at. A sync that lies is worse than no sync: the customer opens the
 * website and finds a theme they never chose. Where no honest equivalent
 * exists, both directions return `null` and the caller does nothing — that is a
 * deliberate outcome, not a failure to handle.
 */

/**
 * The eight ids the website and backend both understand.
 *
 * Kept in the same order as the backend's `VALID` array in
 * `routes/users.js` and the website's `THEMES` in `ThemeContext.jsx`, so the
 * three lists can be compared by eye.
 */
export type SharedThemeId =
  | 'default'
  | 'forest'
  | 'earth'
  | 'navy'
  | 'gold-white'
  | 'sand-travertine'
  | 'rosewood-blush'
  | 'blush-ivory';

export const SHARED_THEME_IDS: SharedThemeId[] = [
  'default',
  'forest',
  'earth',
  'navy',
  'gold-white',
  'sand-travertine',
  'rosewood-blush',
  'blush-ivory',
];

/**
 * What each mobile theme is called in the shared vocabulary.
 *
 * A `Record<ThemeId, …>` rather than a partial map on purpose: adding a sixth
 * mobile theme becomes a compile error here, which forces whoever adds it to
 * decide what it syncs as instead of letting it default to silence.
 *
 *   default → 'default'      the same palette on both platforms.
 *   classic → 'navy'         Heritage Navy is the website's Bosphorus Midnight;
 *                            the website's own LEGACY_THEME_MAP says the same.
 *   light   → 'default'      Light Luxury (#F3EEE4 ground, #4D6B45 green,
 *                            #C4A15A gold) is the same ivory-and-forest family
 *                            as the website's default (#F6F3ED / #4b6741 /
 *                            #C9A35A). Again matching LEGACY_THEME_MAP.
 *   forest  → 'forest'       shared id — but see the parity note below.
 *   dark    → null           see below.
 *
 * ── Why `dark` syncs as nothing ─────────────────────────────────────────
 * The website's LEGACY_THEME_MAP maps `dark` → `gold-white`, and that mapping
 * is wrong for our purposes: Dark Luxury is an obsidian palette (#0E1110
 * ground, the only `isDark: true` theme mobile has), while Ivory & Antique
 * Brass is a light theme (#FBF7EF). Honouring that mapping would mean a
 * customer choosing a dark theme on their phone silently switches the website
 * to a light one. So Dark Luxury stays mobile-only until a genuine
 * cross-platform dark theme exists: it applies locally, it persists locally,
 * and it leaves the server preference untouched.
 *
 * ── Known parity gap: `forest` ──────────────────────────────────────────
 * `forest` is a shared id whose palettes are NOT yet identical. The website's
 * Bosphorus Pine is a deeper green (#0E1912) than mobile's Forest Green
 * (#263D2C). The id is honest — both are the forest theme — but the pixels
 * differ, so cross-platform visual parity is NOT complete. Porting the
 * canonical palette (after a mobile contrast review) belongs to Phase 10F.
 */
const TO_SHARED: Record<ThemeId, SharedThemeId | null> = {
  default: 'default',
  classic: 'navy',
  dark: null,
  light: 'default',
  forest: 'forest',
};

/**
 * The id to store on the account for a locally selected theme.
 *
 * @returns A canonical id safe to send to `PUT /users/me/theme`, or `null` when
 *   this theme is mobile-only and no request should be made at all.
 */
export function toSharedThemeId(themeId: ThemeId): SharedThemeId | null {
  return TO_SHARED[themeId];
}

/**
 * What each canonical id looks like to this build of the mobile app.
 *
 * The five `null`s are not oversights — mobile has no palette for those themes
 * yet, and inventing a stand-in would show the customer a theme they did not
 * choose. `gold-white` is specifically NOT mapped to Dark Luxury for the reason
 * given above: it is a light theme. Phase 10F fills these in.
 */
const FROM_SHARED: Record<SharedThemeId, ThemeId | null> = {
  default: 'default',
  forest: 'forest',
  navy: 'classic',
  earth: null,
  'gold-white': null,
  'sand-travertine': null,
  'rosewood-blush': null,
  'blush-ivory': null,
};

/**
 * Interprets a stored account preference as a mobile theme.
 *
 * Takes `unknown` because the value arrives from the network and may be
 * missing, stale, or a spelling written by a version of the product that no
 * longer exists.
 *
 * Legacy values are passed through: an account written by an older build (or an
 * older website) may still hold `classic`, `dark` or `light`. Those are real
 * mobile themes, so honouring them is truthful — and it means a returning
 * customer's Dark Luxury choice is not thrown away.
 *
 * @returns The theme to apply, or `null` when this build cannot represent the
 *   stored preference honestly. `null` means "leave the current theme alone" —
 *   never a reason to overwrite what the device already has.
 */
export function fromSharedThemeId(value: unknown): ThemeId | null {
  if (typeof value !== 'string') return null;

  // Canonical first: `default` and `forest` are valid in both vocabularies and
  // map to themselves, so the order is not ambiguous.
  if (value in FROM_SHARED) return FROM_SHARED[value as SharedThemeId];

  // Then a legacy mobile id written before this contract existed.
  return toThemeId(value);
}
