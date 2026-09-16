import { usableRemoteImage } from '@/utils/remote-image';

/**
 * STUDIO PALETTE — the admin-managed colour palette, as app data.
 *
 * ── Where it comes from ─────────────────────────────────────────────────
 *   Admin → Studio Colors → StudioPalette (MongoDB)
 *     → GET /api/studio-palette/:pageKey        (public, no auth)
 *       → this module                            (validation)
 *         → Design My Space
 *
 * The SAME document the website's Interior Design and Renovation pages read.
 * There is no app-specific palette endpoint and no app-specific palette data:
 * an owner changing a swatch in Admin changes it in both places, with no app
 * release.
 *
 * ── What the backend does and does not give us ──────────────────────────
 * A palette item is a label and a hex colour, and that is genuinely all:
 *
 *   • NO stable item ids — an item is identified only by its position and
 *     its name, which is why a saved Design Board stores a SNAPSHOT of what
 *     was chosen rather than a pointer into this list (see design-board.ts).
 *   • NO localized names. Every label is English, whatever the app language.
 *   • NO per-item visibility, and no order field — ARRAY ORDER is display
 *     order, so it is preserved exactly.
 *   • NO descriptions, no style catalogue, no lighting catalogue. Those are
 *     app-owned vocabularies (see design-options.ts).
 *
 * ── Validation is deliberately the website's ────────────────────────────
 * `sanitizedMaterials` / `sanitizedFinishes` in the website's
 * InteriorDesignPage.jsx reject a GROUP outright if any item in it is
 * malformed, rather than quietly dropping the bad item. This module copies
 * that rule exactly, so both clients show the same palette for the same
 * document — a half-rendered group on one platform and not the other would be
 * worse than a clean fall back to the built-in defaults.
 *
 * The one deliberate difference: an item's optional texture image is checked
 * with the app's `usableRemoteImage`, which additionally rejects video URLs
 * the app cannot display. A rejected image leaves the item in place with its
 * colour; it never removes the material.
 */

/** The two pages an owner can style. Anything else is a 400 from the backend. */
export type StudioPaletteKey = 'interior-design' | 'renovation';

/** A wall or floor finish: a name and a colour, nothing more. */
export type PaletteFinish = {
  label: string;
  color: string;
};

/** A material, optionally with a texture photograph. */
export type PaletteMaterial = {
  name: string;
  color: string;
  /** '' when absent or unusable — never a broken or non-image URL. */
  image: string;
};

export type StudioPalette = {
  materials: readonly PaletteMaterial[];
  wallFinishes: readonly PaletteFinish[];
  floorFinishes: readonly PaletteFinish[];
};

/**
 * What a successful GET actually told us.
 *
 * The distinction between the two kinds is the whole point of this type, and
 * it is NOT an error case:
 *
 *   'palette'   an owner has saved an override; use it.
 *   'defaults'  the server answered `palette: null`, meaning no override
 *               exists — either none was ever saved, or an owner reset it.
 *               The bundled defaults are then the CORRECT answer, and any
 *               previously cached override is stale and must go.
 *
 * `null` (not a kind) is reserved for "the server did not usefully answer" —
 * offline, a 5xx, or a payload we cannot read — where the caller keeps
 * whatever it is already showing.
 */
export type StudioPaletteResult =
  | { kind: 'palette'; palette: StudioPalette }
  | { kind: 'defaults' };

/** The backend's own limits (backend/models/StudioPalette.js). */
export const PALETTE_LIMITS = {
  materials: 24,
  finishes: 16,
  label: 80,
} as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** A `#RRGGBB` string — the only colour form the backend stores. */
export function isPaletteColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A non-empty name within the backend's length limit, trimmed. */
function paletteLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text && text.length <= PALETTE_LIMITS.label ? text : '';
}

export function sanitizeFinishes(value: unknown, maximum = PALETTE_LIMITS.finishes): PaletteFinish[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return null;

  const finishes: PaletteFinish[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return null;
    const label = paletteLabel(item.label);
    if (!label || !isPaletteColor(item.color)) return null;
    finishes.push({ label, color: item.color });
  }
  return finishes;
}

/** The materials group, or `null` if it is unusable. Same rule as above. */
export function sanitizeMaterials(value: unknown, maximum = PALETTE_LIMITS.materials): PaletteMaterial[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > maximum) return null;

  const materials: PaletteMaterial[] = [];
  for (const item of value) {
    if (!isPlainObject(item)) return null;
    const name = paletteLabel(item.name);
    if (!name || !isPaletteColor(item.color)) return null;
    // An unusable image costs the material its texture, never its place.
    materials.push({ name, color: item.color, image: usableRemoteImage(item.image) });
  }
  return materials;
}

export function paletteFrom(value: unknown, fallback: StudioPalette): StudioPalette {
  const document = isPlainObject(value) ? value : {};

  return {
    materials: sanitizeMaterials(document.materials) ?? fallback.materials,
    wallFinishes: sanitizeFinishes(document.wallFinishes) ?? fallback.wallFinishes,
    floorFinishes: sanitizeFinishes(document.floorFinishes) ?? fallback.floorFinishes,
  };
}

export function normalizeStudioPaletteResponse(
  payload: unknown,
  fallback: StudioPalette
): StudioPaletteResult | null {
  if (!isPlainObject(payload)) return null;
  // An explicit failure envelope is not an answer about the palette.
  if (payload.success === false) return null;
  // A payload that never mentions a palette tells us nothing.
  if (!('palette' in payload)) return null;

  const palette = payload.palette;
  if (palette === null || palette === undefined) return { kind: 'defaults' };
  if (!isPlainObject(palette)) return null;

  return { kind: 'palette', palette: paletteFrom(palette, fallback) };
}

export function normalizeCachedPalette(value: unknown, fallback: StudioPalette): StudioPalette | null {
  if (!isPlainObject(value)) return null;

  const materials = sanitizeMaterials(value.materials);
  const wallFinishes = sanitizeFinishes(value.wallFinishes);
  const floorFinishes = sanitizeFinishes(value.floorFinishes);

  if (!materials && !wallFinishes && !floorFinishes) return null;

  return {
    materials: materials ?? fallback.materials,
    wallFinishes: wallFinishes ?? fallback.wallFinishes,
    floorFinishes: floorFinishes ?? fallback.floorFinishes,
  };
}
