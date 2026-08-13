const IMAGE_BASE_URL = process.env.EXPO_PUBLIC_IMAGE_BASE_URL;

// Names only. The Worker holds the sizes, because a client that could name its
// own width could ask for a 10000px transform of every photo in the bucket.
export const PHOTO_VARIANTS = ['thumb', 'medium', 'full'] as const;

export type PhotoVariant = (typeof PHOTO_VARIANTS)[number];

export function photoUrl(key: string, variant: PhotoVariant = 'medium'): string {
  if (!IMAGE_BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_IMAGE_BASE_URL');
  }

  return `${IMAGE_BASE_URL}/${variant}/${key}`;
}
