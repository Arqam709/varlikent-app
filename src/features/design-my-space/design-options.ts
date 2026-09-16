import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * THE APP-OWNED VOCABULARIES OF DESIGN MY SPACE.
 *
 * Rooms, styles and lighting moods are NOT backend entities. There is no
 * DesignStyle collection, no room catalogue and no lighting catalogue — the
 * website's own style and lighting lists are hardcoded constants inside two
 * page components. So they live here, as stable ids with translated labels,
 * exactly like the app's other interface vocabulary.
 *
 * ── Ids are stable; labels are not ──────────────────────────────────────
 * A saved Design Board stores the ID (`living-room`, `warm`, `night`). That is
 * what makes a board survive a translation change, a language switch and an
 * app update. Labels are looked up through `t()` at render time and never
 * stored.
 *
 * Contrast with wall finishes, floor finishes and materials: those come from
 * the admin-managed Studio Palette, have no stable ids at all, and are
 * therefore stored as snapshots (see design-board.ts).
 *
 * ── Why these particular ids ────────────────────────────────────────────
 * Styles reuse the website's existing ids — the four values Admin → Showroom
 * offers on its Interior tab (`contemporary`, `warm`, `coastal`, `classic`) —
 * so that when interior showroom images are eventually tagged and published,
 * a style card can show real work with NO data migration. (There are zero
 * interior showroom items today, which is exactly why this MVP shows clean
 * icon cards instead of pretending imagery exists.)
 *
 * Lighting reuses the ids behind the website Renovation studio's mood control
 * (`day`, `warm`, `cool`, `night`), and the app's labels are the website's
 * own six-language translations of them rather than a competing vocabulary.
 */

/* ── Rooms ─────────────────────────────────────────────────────────────── */

export const ROOM_IDS = ['living-room', 'bedroom', 'kitchen', 'bathroom', 'office'] as const;
export type RoomId = (typeof ROOM_IDS)[number];

/* ── Styles ────────────────────────────────────────────────────────────── */

export const STYLE_IDS = ['contemporary', 'warm', 'coastal', 'classic'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

/* ── Lighting moods ────────────────────────────────────────────────────── */

export const LIGHTING_IDS = ['day', 'warm', 'cool', 'night'] as const;
export type LightingMoodId = (typeof LIGHTING_IDS)[number];

/* ── The six steps ─────────────────────────────────────────────────────── */

export const DESIGN_STEPS = ['room', 'style', 'wall', 'floor', 'materials', 'lighting'] as const;
export type DesignStep = (typeof DESIGN_STEPS)[number];

/**
 * A choice the user can make.
 *
 * `labelKey` and `descriptionKey` are translation keys, never text: an option
 * carries no English in this file, so nothing here can leak onto a Turkish or
 * Arabic screen.
 */
export type DesignOption<Id extends string> = {
  id: Id;
  icon: keyof typeof Ionicons.glyphMap;
  labelKey: string;
  descriptionKey: string;
};

export const DESIGN_ROOMS: readonly DesignOption<RoomId>[] = [
  { id: 'living-room', icon: 'tv-outline', labelKey: 'designMySpace.rooms.livingRoom', descriptionKey: 'designMySpace.roomHints.livingRoom' },
  { id: 'bedroom', icon: 'bed-outline', labelKey: 'designMySpace.rooms.bedroom', descriptionKey: 'designMySpace.roomHints.bedroom' },
  { id: 'kitchen', icon: 'restaurant-outline', labelKey: 'designMySpace.rooms.kitchen', descriptionKey: 'designMySpace.roomHints.kitchen' },
  { id: 'bathroom', icon: 'water-outline', labelKey: 'designMySpace.rooms.bathroom', descriptionKey: 'designMySpace.roomHints.bathroom' },
  { id: 'office', icon: 'briefcase-outline', labelKey: 'designMySpace.rooms.office', descriptionKey: 'designMySpace.roomHints.office' },
];

export const DESIGN_STYLES: readonly DesignOption<StyleId>[] = [
  { id: 'contemporary', icon: 'square-outline', labelKey: 'designMySpace.styles.contemporary', descriptionKey: 'designMySpace.styleHints.contemporary' },
  { id: 'warm', icon: 'leaf-outline', labelKey: 'designMySpace.styles.warm', descriptionKey: 'designMySpace.styleHints.warm' },
  { id: 'coastal', icon: 'boat-outline', labelKey: 'designMySpace.styles.coastal', descriptionKey: 'designMySpace.styleHints.coastal' },
  { id: 'classic', icon: 'library-outline', labelKey: 'designMySpace.styles.classic', descriptionKey: 'designMySpace.styleHints.classic' },
];

export const DESIGN_LIGHTING: readonly DesignOption<LightingMoodId>[] = [
  { id: 'day', icon: 'sunny-outline', labelKey: 'designMySpace.lighting.day', descriptionKey: 'designMySpace.lightingHints.day' },
  { id: 'warm', icon: 'flame-outline', labelKey: 'designMySpace.lighting.warm', descriptionKey: 'designMySpace.lightingHints.warm' },
  { id: 'cool', icon: 'snow-outline', labelKey: 'designMySpace.lighting.cool', descriptionKey: 'designMySpace.lightingHints.cool' },
  { id: 'night', icon: 'moon-outline', labelKey: 'designMySpace.lighting.night', descriptionKey: 'designMySpace.lightingHints.night' },
];

/* ── Guards, used when reading anything off a device ───────────────────── */

export const isRoomId = (value: unknown): value is RoomId =>
  typeof value === 'string' && (ROOM_IDS as readonly string[]).includes(value);

export const isStyleId = (value: unknown): value is StyleId =>
  typeof value === 'string' && (STYLE_IDS as readonly string[]).includes(value);

export const isLightingMoodId = (value: unknown): value is LightingMoodId =>
  typeof value === 'string' && (LIGHTING_IDS as readonly string[]).includes(value);

/** The translation key for one option id, for summaries and serialization. */
export function designOptionLabelKey(
  options: readonly DesignOption<string>[],
  id: string
): string {
  return options.find((option) => option.id === id)?.labelKey ?? '';
}
