import {
  DESIGN_LIGHTING,
  DESIGN_ROOMS,
  DESIGN_STYLES,
  designOptionLabelKey,
} from '@/features/design-my-space/design-options';
import type { DesignBoard } from '@/features/design-my-space/design-board';
import type { KnownContactInterestId } from '@/features/contact/contact-interests';

/**
 * A DESIGN BOARD, AS A LINE OF TEXT FOR THE EXISTING CONTACT FLOW.
 *
 * Design My Space creates no lead endpoint and no contact interest of its own.
 * It fills in the enquiry form the app already has, which is what keeps the
 * lead inside the flow Varlikent already uses: POST /api/contact, the existing
 * routing rules, the existing admin inbox.
 *
 * ── Why one line, and not a pretty block ────────────────────────────────
 * The lead email renders the message through `escapeHtml` into a plain div,
 * and the admin inbox renders it inside a <p>. Neither converts newlines, so
 * a multi-line board would arrive as one run-on paragraph. Rather than change
 * the backend in a mobile phase, this uses an explicit ' · ' separator that
 * reads correctly in both places today.
 *
 * ── Language ────────────────────────────────────────────────────────────
 * Serialized in the user's CURRENT app language, because it lands in a message
 * box they can read and edit before sending. The one part that cannot be
 * translated is the palette itself: Studio Palette labels are English-only on
 * the backend, so 'Warm Sand' stays 'Warm Sand' in every language.
 *
 * Pure: `translate` is passed in, so this has no React dependency and is
 * directly testable.
 */

/** The stable interest id an interior-design enquiry routes to. */
export const DESIGN_CONSULTATION_INTEREST: KnownContactInterestId = 'interior_design';

/** The shape of the app's own `t()`, so the screen can pass it straight in. */
export type Translate = (key: string, values?: Record<string, string>) => string;

const SEPARATOR = ' · ';

/** Collapses any whitespace, so one field can never break the single line. */
const oneLine = (value: string): string => value.replace(/\s+/g, ' ').trim();

/** `Wall: Warm Sand (#e8ddd0)` */
const finishPart = (label: string, value: string, color: string): string =>
  `${label}: ${value} (${color})`;

/**
 * The message body for a consultation request.
 *
 * Example (English):
 *
 *   Design Board · Room: Living Room · Style: Warm Modern · Wall: Warm Sand
 *   (#e8ddd0) · Floor: Dark Oak (#4a3728) · Materials: Calacatta Marble,
 *   Aged Brass · Lighting: Warm Evening
 */
export function serializeDesignBoard(board: DesignBoard, translate: Translate): string {
  const label = (key: string) => oneLine(translate(key));

  const materials = board.materials.map((material) => oneLine(material.name));

  const parts = [
    label('designMySpace.messagePrefix'),
    `${label('designMySpace.fields.room')}: ${label(designOptionLabelKey(DESIGN_ROOMS, board.room))}`,
    `${label('designMySpace.fields.style')}: ${label(designOptionLabelKey(DESIGN_STYLES, board.style))}`,
    finishPart(label('designMySpace.fields.wall'), oneLine(board.wall.label), board.wall.color),
    finishPart(label('designMySpace.fields.floor'), oneLine(board.floor.label), board.floor.color),
    `${label('designMySpace.fields.materials')}: ${
      materials.length > 0 ? materials.join(', ') : label('designMySpace.noMaterials')
    }`,
    `${label('designMySpace.fields.lighting')}: ${label(designOptionLabelKey(DESIGN_LIGHTING, board.lighting))}`,
  ];

  return parts.join(SEPARATOR);
}

/**
 * The route that hands a board to the Contact screen.
 *
 * The STABLE interest id travels, never a display label and never a palette
 * value — the Contact screen resolves it against the list the server is
 * currently serving, and falls back to General if an owner has disabled
 * Interior Design, exactly as the service pages already do.
 */
export function designConsultationRoute(board: DesignBoard, translate: Translate) {
  return {
    pathname: '/contact' as const,
    params: {
      interestType: DESIGN_CONSULTATION_INTEREST,
      message: serializeDesignBoard(board, translate),
    },
  };
}
