import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { base64ToBytes } from '@/lib/base64';

// The cost rule in CLAUDE.md: never serve an original camera image, target
// roughly 200KB. A 12MP phone photo is 3 to 6MB, so this is the difference
// between a small bill and the whole hosting budget.
const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.8;

// Android only, per the picker's own docs. iOS gives a square crop instead, so
// the card aspect is applied at render with contentFit cover rather than baked
// into the upload. Non-destructive, and identical on every platform.
const ANDROID_CROP_ASPECT: [number, number] = [4, 5];

export type PreparedPhoto = {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
};

// Returns null when the user declines the permission or cancels the picker.
// Neither is an error worth surfacing.
export async function pickPhoto(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: ANDROID_CROP_ASPECT,
    // 1 here, then compressed once below. Compressing twice would throw away
    // detail before the resize has decided what to keep.
    quality: 1,
  });

  if (result.canceled) {
    return null;
  }

  return result.assets[0]?.uri ?? null;
}

// Always re-encodes to JPEG, which is also what makes an iPhone HEIC upload
// work: moderate-photo sniffs the leading bytes and accepts only JPEG, PNG and
// WebP.
export async function preparePhoto(uri: string): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);

  // Width only, so the height follows the original ratio.
  context.resize({ width: MAX_DIMENSION });

  const rendered = await context.renderAsync();

  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: JPEG_QUALITY,
    base64: true,
  });

  if (!saved.base64) {
    throw new Error('Image manipulator returned no base64 payload');
  }

  return { bytes: base64ToBytes(saved.base64), contentType: 'image/jpeg' };
}
