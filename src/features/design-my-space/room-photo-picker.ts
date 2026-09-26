import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import {
  ROOM_PHOTO_UPLOAD_COMPRESS,
  roomPhotoResizeTarget,
} from '@/features/design-my-space/room-photo';
import type { UploadFile } from '@/services/api-upload';

/**
 * TAKING OR CHOOSING A ROOM PHOTO, AND PREPARING IT FOR UPLOAD.
 *
 * Permissions are requested here, only when the user taps "Take Photo" or
 * "Choose From Gallery" — never at startup — so each prompt arrives with an
 * obvious reason.
 *
 * Preparation is a BANDWIDTH OPTIMIZATION, not a safety measure: the photo is
 * re-encoded to a JPEG no larger than the backend keeps anyway, which also
 * turns an iPhone HEIC into something the backend accepts. The backend still
 * validates, orients, resizes and strips metadata itself, and never trusts
 * anything done here.
 */

export type PickedRoomPhoto = UploadFile & { width: number; height: number };

export type PickOutcome =
  | { type: 'picked'; photo: PickedRoomPhoto }
  | { type: 'cancelled' }
  | { type: 'permission-denied' };

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  // A room photo is used whole. Square cropping (as for avatars) would cut
  // away most of the room.
  allowsEditing: false,
  // Full quality from the picker: the one compression step is below.
  quality: 1,
  // Never read EXIF into JavaScript. It can include the home's location.
  exif: false,
};

async function prepare(asset: ImagePicker.ImagePickerAsset): Promise<PickedRoomPhoto> {
  const context = ImageManipulator.manipulate(asset.uri);
  const target = roomPhotoResizeTarget(asset.width, asset.height);
  if (target) context.resize(target);

  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: ROOM_PHOTO_UPLOAD_COMPRESS });

  return {
    uri: saved.uri,
    // A fixed name: the user's own filename says nothing the backend needs.
    name: 'room-photo.jpg',
    type: 'image/jpeg',
    width: saved.width,
    height: saved.height,
  };
}

async function launch(source: 'camera' | 'library'): Promise<PickOutcome> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { type: 'permission-denied' };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
      : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

  // Backing out is a normal outcome, not an error.
  if (result.canceled) return { type: 'cancelled' };
  const asset = result.assets?.[0];
  if (!asset?.uri) return { type: 'cancelled' };

  return { type: 'picked', photo: await prepare(asset) };
}

/** "Take Photo". Asks for camera permission at this moment only. */
export const takeRoomPhoto = () => launch('camera');

/** "Choose From Gallery". Asks for photo library permission at this moment only. */
export const chooseRoomPhoto = () => launch('library');
