/**
 * ROOM PHOTOS — the app's side of the private room-photo contract.
 *
 * A room photo is a picture of the inside of someone's home, uploaded so a
 * Design My Space board can later be visualized in that room. The backend is
 * the authority on everything here: it validates the actual image, strips all
 * metadata, stores it privately and serves it back only to its owner. This
 * module only mirrors what the app needs to talk to it.
 *
 * What the app never receives or keeps: a storage URL, a Cloudinary ID, EXIF
 * or location data. A photo is known by its record id alone.
 */

/**
 * The room-photo notice version the user accepts before uploading.
 * MUST equal ROOM_PHOTO_CONSENT_VERSION in the backend's
 * config/designRoomPhotos.js — a parity test pins them. When the notice's
 * meaning changes, both change together, and the backend refuses uploads from
 * builds still showing the old notice.
 */
export const ROOM_PHOTO_CONSENT_VERSION = '2026-09-room-photo-v1';

/**
 * The long edge the app resizes to before uploading. A bandwidth optimization
 * only — the backend applies the same ceiling itself and never trusts this.
 */
export const ROOM_PHOTO_UPLOAD_LONG_EDGE = 2048;

/** JPEG compression for the upload copy: close to the backend's own re-encode. */
export const ROOM_PHOTO_UPLOAD_COMPRESS = 0.85;

/** The multipart field names the backend expects, in the order it expects them. */
export const ROOM_PHOTO_FORM_FIELDS = { consent: 'consentVersion', photo: 'photo' } as const;

export type RoomPhoto = {
  id: string;
  width: number;
  height: number;
  createdAt: string;
  expiresAt: string;
};

const OBJECT_ID = /^[0-9a-f]{24}$/i;

const positiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

/**
 * A room photo from the API, or null if it cannot be trusted.
 *
 * Only a `ready` photo is usable. Anything else the response may carry is
 * dropped rather than copied — so even a backend mistake could not put a
 * storage identifier into app state.
 */
export function roomPhotoFromServer(value: unknown): RoomPhoto | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;

  if (typeof raw._id !== 'string' || !OBJECT_ID.test(raw._id)) return null;
  if (raw.status !== 'ready') return null;
  if (!positiveInteger(raw.width) || !positiveInteger(raw.height)) return null;
  if (!timestamp(raw.createdAt) || !timestamp(raw.expiresAt)) return null;

  return { id: raw._id, width: raw.width, height: raw.height, createdAt: raw.createdAt, expiresAt: raw.expiresAt };
}

/** Whether a string could be a room photo id (for route parameters). */
export const isRoomPhotoId = (value: unknown): value is string => typeof value === 'string' && OBJECT_ID.test(value);

/**
 * The size to resize a picked photo to, or null when it is already small
 * enough. Never enlarges. Picker dimensions can be 0 when the system does not
 * report them; then the photo is simply re-encoded at its own size.
 */
export function roomPhotoResizeTarget(
  width: number,
  height: number,
  maxLongEdge: number = ROOM_PHOTO_UPLOAD_LONG_EDGE
): { width: number } | { height: number } | null {
  if (!positiveInteger(width) || !positiveInteger(height)) return null;
  if (Math.max(width, height) <= maxLongEdge) return null;
  // One side only; the manipulator keeps the aspect ratio.
  return width >= height ? { width: maxLongEdge } : { height: maxLongEdge };
}

/**
 * The translation key for a failed upload or load, from the backend's `code`.
 * Unknown codes fall back to a general message rather than showing English
 * text from the server.
 */
const ERROR_KEYS: Record<string, string> = {
  PHOTO_UNREADABLE: 'designMySpace.roomPhoto.errors.unreadable',
  PHOTO_UNSUPPORTED_FORMAT: 'designMySpace.roomPhoto.errors.unsupported',
  PHOTO_DIMENSIONS_TOO_LARGE: 'designMySpace.roomPhoto.errors.tooLarge',
  PHOTO_FILE_TOO_LARGE: 'designMySpace.roomPhoto.errors.tooLarge',
  PHOTO_TOO_SMALL: 'designMySpace.roomPhoto.errors.tooSmall',
  PHOTO_ASPECT_RATIO: 'designMySpace.roomPhoto.errors.aspect',
  CONSENT_REQUIRED: 'designMySpace.roomPhoto.errors.consent',
  ROOM_PHOTO_LIMIT_REACHED: 'designMySpace.roomPhoto.errors.limit',
  ROOM_PHOTO_DAILY_LIMIT: 'designMySpace.roomPhoto.errors.dailyLimit',
  ROOM_PHOTO_BUSY: 'designMySpace.roomPhoto.errors.busy',
};

export function roomPhotoErrorKey(error: { code?: string; kind?: string } | null | undefined): string {
  if (error?.code && ERROR_KEYS[error.code]) return ERROR_KEYS[error.code];
  if (error?.kind === 'network' || error?.kind === 'timeout') return 'designMySpace.roomPhoto.errors.network';
  if (error?.kind === 'auth') return 'designMySpace.roomPhoto.errors.session';
  return 'designMySpace.roomPhoto.errors.generic';
}
