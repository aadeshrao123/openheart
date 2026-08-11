const IMAGE_BASE_URL = process.env.EXPO_PUBLIC_IMAGE_BASE_URL;

// The swipe deck is roughly 95% of all image traffic, so what `thumb` resolves
// to is the single largest factor in the hosting bill. Never render an original
// upload.
export const PHOTO_VARIANTS = {
  thumb: 'w=200,h=200,fit=cover,quality=75',
  medium: 'w=600,quality=80',
  full: 'w=1080,quality=82',
} as const;

export type PhotoVariant = keyof typeof PHOTO_VARIANTS;

export function photoUrl(key: string, variant: PhotoVariant = 'medium'): string {
  if (!IMAGE_BASE_URL) {
    throw new Error('Missing EXPO_PUBLIC_IMAGE_BASE_URL');
  }

  return `${IMAGE_BASE_URL}/cdn-cgi/image/${PHOTO_VARIANTS[variant]}/${key}`;
}
