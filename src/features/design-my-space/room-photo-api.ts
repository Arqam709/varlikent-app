import { API_BASE_URL } from '@/constants/config';
import {
  ROOM_PHOTO_CONSENT_VERSION,
  ROOM_PHOTO_FORM_FIELDS,
  roomPhotoFromServer,
  type RoomPhoto,
} from '@/features/design-my-space/room-photo';
import { ApiError, apiRequest } from '@/services/api-client';
import { apiUpload, appendFile, type UploadFile } from '@/services/api-upload';

/**
 * ROOM PHOTO ENDPOINTS — network only.
 *
 * Every call carries the signed-in user's token; the backend scopes each query
 * by the authenticated id, so a photo id that belongs to someone else is a 404.
 */

type PhotoResponse = { success: true; photo?: unknown };
type PhotosResponse = { success: true; photos?: unknown };

/**
 * GET /api/design-room-photos — this user's ready room photos, newest first.
 *
 * Exists so a photo from an earlier visit can be found again, reused or
 * deleted; it is not a gallery. Unreadable entries are skipped.
 */
export async function fetchRoomPhotos(token: string): Promise<RoomPhoto[]> {
  const response = await apiRequest<PhotosResponse>('/design-room-photos', { token });
  if (!Array.isArray(response?.photos)) {
    throw new ApiError('unknown', 'The server returned an unreadable list of room photos.');
  }
  return response.photos.map(roomPhotoFromServer).filter((photo): photo is RoomPhoto => photo !== null);
}

function photoOrThrow(response: PhotoResponse | null): RoomPhoto {
  const photo = roomPhotoFromServer(response?.photo);
  if (!photo) throw new ApiError('unknown', 'The server returned an unreadable room photo.');
  return photo;
}

/**
 * POST /api/design-room-photos
 *
 * `consentVersion` is appended BEFORE the photo: the backend checks consent as
 * the file part begins, so a request without it is refused before any photo
 * bytes are accepted. Callers only reach this after the user ticked consent.
 */
export async function uploadRoomPhoto(token: string, file: UploadFile): Promise<RoomPhoto> {
  const form = new FormData();
  form.append(ROOM_PHOTO_FORM_FIELDS.consent, ROOM_PHOTO_CONSENT_VERSION);
  appendFile(form, ROOM_PHOTO_FORM_FIELDS.photo, file);

  const response = await apiUpload<PhotoResponse | null>('/design-room-photos', {
    method: 'POST',
    token,
    form,
    timeoutMessage: 'The room photo upload took too long. Please try again.',
  });
  return photoOrThrow(response);
}

/** GET /api/design-room-photos/:id */
export async function fetchRoomPhoto(token: string, id: string): Promise<RoomPhoto> {
  return photoOrThrow(await apiRequest<PhotoResponse>(`/design-room-photos/${id}`, { token }));
}

/** DELETE /api/design-room-photos/:id — 404 when it is not (or no longer) this user's. */
export async function deleteRoomPhoto(token: string, id: string): Promise<void> {
  await apiRequest(`/design-room-photos/${id}`, { method: 'DELETE', token });
}

/**
 * How `expo-image` loads a room photo: from the API, with the Bearer token as
 * a header, never from a storage URL. The image endpoint only answers the
 * photo's owner, so this source is useless to anyone else — and it is built on
 * demand, never stored.
 */
export function roomPhotoImageSource(token: string, id: string) {
  return {
    uri: `${API_BASE_URL}/design-room-photos/${id}/image`,
    headers: { Authorization: `Bearer ${token}` },
  };
}
