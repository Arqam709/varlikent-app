import {
  DESIGN_STEPS,
  isLightingMoodId,
  isRoomId,
  isStyleId,
  type DesignStep,
  type LightingMoodId,
  type RoomId,
  type StyleId,
} from '@/features/design-my-space/design-options';
import {
  isPaletteColor,
  PALETTE_LIMITS,
  type PaletteFinish,
  type PaletteMaterial,
} from '@/features/studio-palette/studio-palette';
import { usableRemoteImage } from '@/utils/remote-image';

export const DESIGN_BOARD_VERSION = 1;

/** A wall or floor finish, as chosen. */
export type FinishSnapshot = {
  label: string;
  color: string;
};

/** A material, as chosen, with its texture if it had one. */
export type MaterialSnapshot = {
  name: string;
  color: string;
  /** Absent when the material had no usable texture image. */
  image?: string;
};

export type DesignBoard = {
  version: typeof DESIGN_BOARD_VERSION;
  id: string;
  room: RoomId;
  style: StyleId;
  wall: FinishSnapshot;
  floor: FinishSnapshot;
  /** May be empty: choosing no materials is a legitimate brief. */
  materials: MaterialSnapshot[];
  lighting: LightingMoodId;
  createdAt: string;
  updatedAt: string;
};

/** A board being built or edited. Every single-select step may still be unset. */
export type DesignDraft = {
  room: RoomId | null;
  style: StyleId | null;
  wall: FinishSnapshot | null;
  floor: FinishSnapshot | null;
  materials: MaterialSnapshot[];
  lighting: LightingMoodId | null;
};

export const EMPTY_DESIGN_DRAFT: DesignDraft = {
  room: null,
  style: null,
  wall: null,
  floor: null,
  materials: [],
  lighting: null,
};

/* ── Snapshots ─────────────────────────────────────────────────────────── */

export const finishSnapshot = (finish: PaletteFinish): FinishSnapshot => ({
  label: finish.label,
  color: finish.color,
});

export const materialSnapshot = (material: PaletteMaterial): MaterialSnapshot =>
  // `image` is omitted rather than stored as '' so a board carries no empty
  // keys, and an unusable texture simply becomes a colour swatch.
  material.image ? { name: material.name, color: material.color, image: material.image } : { name: material.name, color: material.color };

/**
 * Palette items carry no ids, so identity is the pair a user can actually
 * see: the name and the colour. Two materials sharing both ARE the same
 * choice, whatever their position in the palette.
 */
export const isSameFinish = (a: FinishSnapshot | null, b: FinishSnapshot | null): boolean =>
  !!a && !!b && a.label === b.label && a.color === b.color;

export const isSameMaterial = (a: MaterialSnapshot, b: MaterialSnapshot): boolean =>
  a.name === b.name && a.color === b.color;

/* ── Validation ────────────────────────────────────────────────────────── */

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function snapshotLabel(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text && text.length <= PALETTE_LIMITS.label ? text : '';
}

function timestamp(value: unknown): string {
  return typeof value === 'string' && value.trim() && !Number.isNaN(Date.parse(value)) ? value : '';
}

export function normalizeFinishSnapshot(value: unknown): FinishSnapshot | null {
  if (!isPlainObject(value)) return null;
  const label = snapshotLabel(value.label);
  if (!label || !isPaletteColor(value.color)) return null;
  return { label, color: value.color };
}

export function normalizeMaterialSnapshot(value: unknown): MaterialSnapshot | null {
  if (!isPlainObject(value)) return null;
  const name = snapshotLabel(value.name);
  if (!name || !isPaletteColor(value.color)) return null;

  const image = usableRemoteImage(value.image);
  return image ? { name, color: value.color, image } : { name, color: value.color };
}

/**
 * A list of materials, de-duplicated and capped.
 *
 * Unlike a palette GROUP — where one malformed item invalidates the whole
 * group, matching the website — a malformed entry here is simply skipped. A
 * board is the user's own saved work, and salvaging five of six materials is
 * always better than discarding the board.
 */
export function normalizeMaterialSnapshots(value: unknown): MaterialSnapshot[] {
  if (!Array.isArray(value)) return [];

  const materials: MaterialSnapshot[] = [];
  for (const item of value) {
    const material = normalizeMaterialSnapshot(item);
    if (!material) continue;
    if (materials.some((chosen) => isSameMaterial(chosen, material))) continue;
    if (materials.length >= PALETTE_LIMITS.materials) break;
    materials.push(material);
  }
  return materials;
}

/**
 * One stored record as a board, or `null` if it cannot be trusted.
 *
 * Every field is checked, because this reads whatever is on the device: a
 * record written by a future version, a partially written record, or storage
 * that has been corrupted. The caller drops what returns null and keeps the
 * rest.
 */
export function normalizeDesignBoard(value: unknown): DesignBoard | null {
  if (!isPlainObject(value)) return null;
  if (value.version !== DESIGN_BOARD_VERSION) return null;

  const { id, room, style, lighting } = value;
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
  if (!isRoomId(room) || !isStyleId(style) || !isLightingMoodId(lighting)) return null;

  const wall = normalizeFinishSnapshot(value.wall);
  const floor = normalizeFinishSnapshot(value.floor);
  if (!wall || !floor) return null;

  const createdAt = timestamp(value.createdAt);
  if (!createdAt) return null;

  return {
    version: DESIGN_BOARD_VERSION,
    id,
    room,
    style,
    wall,
    floor,
    materials: normalizeMaterialSnapshots(value.materials),
    lighting,
    createdAt,
    // A board that somehow lost its update time is dated by its creation,
    // which is the only honest answer available.
    updatedAt: timestamp(value.updatedAt) || createdAt,
  };
}

/* ── Ids ───────────────────────────────────────────────────────────────── */

/**
 * A local board id.
 *
 * Not security-sensitive and never leaves the device, so `Math.random` is
 * appropriate and no uuid dependency is warranted. Time-prefixed so ids sort
 * roughly by age and a collision would need two boards created in the same
 * millisecond AND the same 8 random characters.
 */
export function createDesignBoardId(): string {
  return `dms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/* ── Drafts ────────────────────────────────────────────────────────────── */

/** Has this step been answered? Materials are optional, so they are always complete. */
export function isStepComplete(draft: DesignDraft, step: DesignStep): boolean {
  switch (step) {
    case 'room':
      return draft.room !== null;
    case 'style':
      return draft.style !== null;
    case 'wall':
      return draft.wall !== null;
    case 'floor':
      return draft.floor !== null;
    case 'materials':
      // Zero materials is a valid answer — a user may have no preference.
      return true;
    case 'lighting':
      return draft.lighting !== null;
    default:
      return false;
  }
}

/** The first step still unanswered, or null when the draft is complete. */
export function firstIncompleteStep(draft: DesignDraft): DesignStep | null {
  return DESIGN_STEPS.find((step) => !isStepComplete(draft, step)) ?? null;
}

/**
 * A finished board from a complete draft, or `null` if a required choice is
 * missing — which is what stops a half-answered flow ever reaching a summary
 * or a consultation request.
 */
export function boardFromDraft(
  draft: DesignDraft,
  options: { id: string; now: string; createdAt?: string }
): DesignBoard | null {
  const { room, style, wall, floor, lighting } = draft;
  if (!room || !style || !wall || !floor || !lighting) return null;

  return {
    version: DESIGN_BOARD_VERSION,
    id: options.id,
    room,
    style,
    // Copied, so later edits to the draft cannot reach through into a saved board.
    wall: { ...wall },
    floor: { ...floor },
    materials: draft.materials.map((material) => ({ ...material })),
    lighting,
    createdAt: options.createdAt ?? options.now,
    updatedAt: options.now,
  };
}

/** A draft seeded from a saved board, for editing. The board is not mutated. */
export function draftFromBoard(board: DesignBoard): DesignDraft {
  return {
    room: board.room,
    style: board.style,
    wall: { ...board.wall },
    floor: { ...board.floor },
    materials: board.materials.map((material) => ({ ...material })),
    lighting: board.lighting,
  };
}

/** Adds or removes one material. Returns a new array; never mutates. */
export function toggleMaterial(
  materials: readonly MaterialSnapshot[],
  material: MaterialSnapshot
): MaterialSnapshot[] {
  const chosen = materials.some((item) => isSameMaterial(item, material));
  if (chosen) return materials.filter((item) => !isSameMaterial(item, material));
  // The backend's own ceiling, not an invented business rule.
  if (materials.length >= PALETTE_LIMITS.materials) return [...materials];
  return [...materials, material];
}

/* ── Keeping an old board's choices visible ────────────────────────────── */

/**
 * The finishes to offer, with the user's current choice guaranteed present.
 *
 * When an old board is reopened after an owner changed the palette, the saved
 * finish may no longer be on offer. Dropping it would silently deselect the
 * step and make the user re-answer it; this keeps it, first, so the board can
 * be edited without losing what it already says.
 */
export function finishOptionsWithSelection(
  options: readonly PaletteFinish[],
  selected: FinishSnapshot | null
): PaletteFinish[] {
  if (!selected) return [...options];
  if (options.some((option) => isSameFinish(option, selected))) return [...options];
  return [{ label: selected.label, color: selected.color }, ...options];
}

/** The same rule for materials: chosen-but-no-longer-offered stays visible. */
export function materialOptionsWithSelection(
  options: readonly PaletteMaterial[],
  selected: readonly MaterialSnapshot[]
): PaletteMaterial[] {
  const missing = selected.filter(
    (choice) => !options.some((option) => isSameMaterial(option, choice))
  );
  return [
    ...missing.map((choice) => ({ name: choice.name, color: choice.color, image: choice.image ?? '' })),
    ...options,
  ];
}
