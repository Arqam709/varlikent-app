import type { StudioPalette, StudioPaletteKey } from '@/features/studio-palette/studio-palette';

/**
 * THE BUILT-IN PALETTE — what Design My Space shows when no override exists.
 *
 * ── Why the app ships a copy at all ─────────────────────────────────────
 * Because it is the LIVE state, not a theoretical fallback. At the time of
 * writing, `GET /api/studio-palette/interior-design` answers
 * `{ success: true, palette: null }`: no owner has saved an override, and the
 * website itself renders from exactly these values. A build without them would
 * show an empty flow to every user today.
 *
 * It also covers the first offline launch, and any moment the server is
 * unreachable before a cache exists.
 *
 * ── Where these values come from ────────────────────────────────────────
 * Copied from the website's own defaults, which are declared IDENTICALLY in
 * three files (frontend/src/pages/InteriorDesignPage.jsx, RenovationPage.jsx
 * and AdminStudioPalette.jsx). tests/studio-palette-parity.test.mjs reads
 * those files when the website repository is checked out beside this one and
 * fails if they drift from this table.
 *
 * ── The two theme-variable colours ──────────────────────────────────────
 * Two website defaults are NOT hex literals. They are CSS custom properties:
 *
 *     Aged Brass    C.gold  → var(--vk-gold)
 *     Forest Green  C.green → var(--vk-green)
 *
 * so on the website those two swatches change with the active site theme.
 * React Native has no CSS variables, and a palette colour must be a literal —
 * so both are pinned to the DEFAULT theme's value from the website's
 * index.css (`html[data-theme="default"]`), which is also exactly what the
 * app's own gold and green brand tokens are:
 *
 *     --vk-gold:  #C9A35A
 *     --vk-green: #5E7F52
 *
 * They are written as literals rather than imported from constants/theme.ts
 * on purpose: these are Varlikent's MATERIAL colours, which happen to match
 * the brand today. Wiring them to the app's theme tokens would silently
 * repaint a material when a user picked a different app theme.
 *
 * Anything an owner saves in Admin → Studio Colors replaces all of this.
 */

/** Materials, wall and floor finishes, in the website's display order. */
const DEFAULT_PALETTE: StudioPalette = {
  materials: [
    { name: 'Calacatta Marble', color: '#f2ede8', image: '' },
    { name: 'Raw Concrete', color: '#8a8a8a', image: '' },
    { name: 'Dark Walnut', color: '#3d2b1f', image: '' },
    // C.gold on the website — see the note above.
    { name: 'Aged Brass', color: '#C9A35A', image: '' },
    { name: 'Nero Stone', color: '#1a1a1a', image: '' },
    { name: 'Linen White', color: '#f8f5f0', image: '' },
    // C.green on the website — see the note above.
    { name: 'Forest Green', color: '#5E7F52', image: '' },
    { name: 'Midnight Navy', color: '#202a36', image: '' },
  ],
  wallFinishes: [
    { label: 'Ivory', color: '#f5f0e8' },
    { label: 'Warm Sand', color: '#e8ddd0' },
    { label: 'Slate Blue', color: '#8fa3b1' },
    { label: 'Sage', color: '#8fa88a' },
    { label: 'Charcoal', color: '#3d4655' },
    { label: 'Navy', color: '#202a36' },
  ],
  floorFinishes: [
    { label: 'Dark Oak', color: '#4a3728' },
    { label: 'Light Ash', color: '#c4a882' },
    { label: 'Concrete', color: '#8a8a8a' },
    { label: 'Marble', color: '#efe9e1' },
  ],
};

/**
 * The defaults per page.
 *
 * Both pages currently share one table — the website declares the same values
 * for Renovation as for Interior Design — but they are addressed by key so a
 * future divergence is a data change here rather than a structural one, and so
 * the Renovation planner can read this layer unchanged.
 */
export const STUDIO_PALETTE_FALLBACK: Record<StudioPaletteKey, StudioPalette> = {
  'interior-design': DEFAULT_PALETTE,
  renovation: DEFAULT_PALETTE,
};

/** The bundled palette for one page. Never null, never empty. */
export function fallbackStudioPalette(key: StudioPaletteKey): StudioPalette {
  return STUDIO_PALETTE_FALLBACK[key];
}
