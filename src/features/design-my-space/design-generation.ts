/**
 * ROOM VISUALIZATIONS — the app's side of the generation contract.
 *
 * A generation is one request: this saved design, with this room photo. The
 * backend owns everything about it. The app sends two ids and a retry key, and
 * reads back a status.
 *
 * ── What the app must never do ──────────────────────────────────────────
 * It never sends a board configuration (the server snapshots the stored board
 * itself), never sends a prompt, and never sets a status. It never receives a
 * storage identifier: a finished visualization is loaded from the API with the
 * signed-in user's token, and only the server may say that one exists.
 */

/** The lifecycle, as the app is allowed to see it. `deleted` never arrives. */
export const DESIGN_GENERATION_STATUSES = ['queued', 'processing', 'succeeded', 'failed'] as const;
export type DesignGenerationStatus = (typeof DESIGN_GENERATION_STATUSES)[number];

/** Still going: the app shows progress, not a result. */
export const isActiveGenerationStatus = (status: DesignGenerationStatus): boolean =>
  status === 'queued' || status === 'processing';

/** Finished, one way or the other: nothing more will change on its own. */
export const isTerminalGenerationStatus = (status: DesignGenerationStatus): boolean =>
  !isActiveGenerationStatus(status);

/** Whether the generated image can be loaded: the server says one exists. */
export const hasVisualizationImage = (generation: DesignGeneration | null): boolean =>
  Boolean(generation && generation.status === 'succeeded' && generation.hasResult);

/** The design a generation used, as it was at that moment. Display only. */
export type DesignGenerationBoard = {
  room: string;
  style: string;
  wall: { label: string; color: string };
  floor: { label: string; color: string };
  materials: { name: string; color: string }[];
  lighting: string;
};

export type DesignGeneration = {
  id: string;
  status: DesignGenerationStatus;
  boardId: string;
  roomPhotoId: string;
  board: DesignGenerationBoard;
  /** Whether a generated image exists. Always false until a provider exists. */
  hasResult: boolean;
  errorCode: string | null;
  createdAt: string;
  completedAt: string | null;
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown, max = 120): string =>
  typeof value === 'string' && value.trim() && value.length <= max ? value : '';

const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

function normalizeBoard(value: unknown): DesignGenerationBoard | null {
  if (!isObject(value)) return null;

  const finish = (raw: unknown) => {
    if (!isObject(raw)) return null;
    const label = text(raw.label, 80);
    const color = text(raw.color, 7);
    return label && color ? { label, color } : null;
  };

  const wall = finish(value.wall);
  const floor = finish(value.floor);
  const room = text(value.room, 64);
  const style = text(value.style, 64);
  const lighting = text(value.lighting, 64);
  if (!wall || !floor || !room || !style || !lighting) return null;

  const materials = Array.isArray(value.materials)
    ? value.materials
        .map((material) => (isObject(material) ? { name: text(material.name, 80), color: text(material.color, 7) } : null))
        .filter((material): material is { name: string; color: string } => Boolean(material?.name && material?.color))
    : [];

  return { room, style, wall, floor, materials, lighting };
}

/**
 * One generation from the API, or null if it cannot be trusted.
 *
 * Only known fields are copied, so even a backend mistake could not put a
 * storage identifier or a prompt into app state.
 */
export function designGenerationFromServer(value: unknown): DesignGeneration | null {
  if (!isObject(value)) return null;

  const { _id: id, status, boardId, roomPhotoId } = value;
  if (typeof id !== 'string' || !OBJECT_ID.test(id)) return null;
  if (typeof status !== 'string' || !(DESIGN_GENERATION_STATUSES as readonly string[]).includes(status)) return null;
  if (typeof boardId !== 'string' || !OBJECT_ID.test(boardId)) return null;
  if (typeof roomPhotoId !== 'string' || !OBJECT_ID.test(roomPhotoId)) return null;
  if (!timestamp(value.createdAt)) return null;

  const board = normalizeBoard(value.board);
  if (!board) return null;

  return {
    id,
    status: status as DesignGenerationStatus,
    boardId,
    roomPhotoId,
    board,
    // A result can only be claimed by the server, and only once one exists.
    hasResult: value.hasResult === true,
    errorCode: typeof value.errorCode === 'string' ? value.errorCode : null,
    createdAt: value.createdAt,
    completedAt: timestamp(value.completedAt) ? value.completedAt : null,
  };
}

/**
 * A retry key for one attempt.
 *
 * Generated when the user taps, and reused for every retry of THAT attempt, so
 * a lost response or a double tap cannot queue the same visualization twice.
 * Not security-sensitive: the backend scopes keys to the signed-in user.
 */
export function createGenerationIdempotencyKey(): string {
  const random = () => Math.random().toString(36).slice(2, 10);
  return `dg-${Date.now().toString(36)}-${random()}${random()}`;
}

/** The translation key for a failed request or a failed generation. */
const ERROR_KEYS: Record<string, string> = {
  FEATURE_DISABLED: 'designMySpace.visualize.errors.unavailable',
  BOARD_NOT_FOUND: 'designMySpace.visualize.errors.boardMissing',
  BOARD_UNUSABLE: 'designMySpace.visualize.errors.boardUnusable',
  ROOM_PHOTO_NOT_FOUND: 'designMySpace.visualize.errors.photoMissing',
  ROOM_PHOTO_EXPIRED: 'designMySpace.visualize.errors.photoExpired',
  GENERATION_ACTIVE_LIMIT: 'designMySpace.visualize.errors.activeLimit',
  GENERATION_DAILY_LIMIT: 'designMySpace.visualize.errors.dailyLimit',
  IDEMPOTENCY_KEY_REUSED: 'designMySpace.visualize.errors.generic',
  GENERATION_NOT_FOUND: 'designMySpace.visualize.errors.generic',
  INVALID_REQUEST: 'designMySpace.visualize.errors.generic',
  // Outcomes recorded ON a generation, shown when it failed.
  SOURCE_PHOTO_UNAVAILABLE: 'designMySpace.visualize.errors.photoMissing',
  NOT_PROCESSED_IN_TIME: 'designMySpace.visualize.errors.notProcessed',
  LEASE_EXPIRED: 'designMySpace.visualize.errors.notProcessed',
  PROVIDER_FAILED: 'designMySpace.visualize.errors.generic',
  PROVIDER_REJECTED_CONTENT: 'designMySpace.visualize.errors.rejected',
  PROVIDER_TIMEOUT: 'designMySpace.visualize.errors.notProcessed',
  PROVIDER_INVALID_IMAGE: 'designMySpace.visualize.errors.generic',
  RESULT_STORAGE_FAILED: 'designMySpace.visualize.errors.generic',
  RESULT_UNAVAILABLE: 'designMySpace.visualize.errors.resultUnavailable',
};

export function designGenerationErrorKey(error: { code?: string; kind?: string } | null | undefined): string {
  if (error?.code && ERROR_KEYS[error.code]) return ERROR_KEYS[error.code];
  if (error?.kind === 'network' || error?.kind === 'timeout') return 'designMySpace.visualize.errors.network';
  if (error?.kind === 'auth') return 'designMySpace.visualize.errors.session';
  return 'designMySpace.visualize.errors.generic';
}

/** The status line shown for a generation. There is no "finished" wording. */
export function designGenerationStatusKey(generation: DesignGeneration): string {
  if (generation.status === 'failed') return designGenerationErrorKey({ code: generation.errorCode ?? undefined });
  if (generation.status === 'succeeded') return 'designMySpace.visualize.status.succeeded';
  return `designMySpace.visualize.status.${generation.status}`;
}
