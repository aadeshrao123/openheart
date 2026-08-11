import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Text } from './text';
import { cn } from '@/lib/cn';
import { photoUrl } from '@/lib/photos';

type Size = keyof typeof sizes;

const sizes = {
  sm: { box: 'h-8 w-8', text: 'caption', photo: 'thumb' },
  md: { box: 'h-12 w-12', text: 'label', photo: 'thumb' },
  lg: { box: 'h-20 w-20', text: 'heading', photo: 'medium' },
} as const;

export type AvatarProps = {
  photoKey?: string | null;
  name: string;
  size?: Size;
  className?: string;
};

export function Avatar({
  photoKey,
  name,
  size = 'md',
  className,
}: AvatarProps) {
  const { t } = useTranslation();
  const dimensions = sizes[size];
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <View
      className={cn(
        'items-center justify-center overflow-hidden rounded-full bg-brand-subtle',
        dimensions.box,
        className,
      )}
    >
      {photoKey ? (
        <Image
          source={{ uri: photoUrl(photoKey, dimensions.photo) }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
          accessibilityLabel={t('profile.photo_alt', { name })}
        />
      ) : (
        <Text variant={dimensions.text} tone="brand">
          {initial}
        </Text>
      )}
    </View>
  );
}
