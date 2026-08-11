import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Text } from './text';
import { cn } from '@/lib/cn';
import { tintIndex } from '@/lib/avatar-tint';
import { photoUrl } from '@/lib/photos';

type Size = keyof typeof sizes;

const sizes = {
  sm: { box: 'h-8 w-8', text: 'caption', photo: 'thumb' },
  md: { box: 'h-12 w-12', text: 'label', photo: 'thumb' },
  lg: { box: 'h-20 w-20', text: 'heading', photo: 'medium' },
} as const;

// Three, because three is what the token set honestly contains. --brand and
// --accent are the only two tints that mean "a person" rather than a verdict:
// tinting somebody with --danger or --warning says something about them.
// The third is the neutral surface. A wider range of avatar colours would be a
// new palette, and the token names describe purpose rather than appearance
// precisely so that palettes do not accumulate.
const tints = [
  { container: 'bg-brand-subtle', text: 'brand' },
  { container: 'bg-accent-subtle', text: 'accent' },
  { container: 'bg-surface', text: 'muted' },
] as const;

export type AvatarProps = {
  photoKey?: string | null;
  name: string;
  // Any stable string belonging to whoever this avatar is for. Only ever used
  // to choose a tint, which is why this primitive can take it without knowing
  // what a profile is. Without one every fallback is the same colour.
  identity?: string | null;
  size?: Size;
  className?: string;
};

export function Avatar({
  photoKey,
  name,
  identity,
  size = 'md',
  className,
}: AvatarProps) {
  const { t } = useTranslation();
  const dimensions = sizes[size];

  // Array.from, not charAt. charAt returns one UTF-16 code unit, so a name
  // beginning with an emoji or any astral-plane character produced half a
  // surrogate pair and rendered as a replacement box.
  const initial = Array.from(name.trim())[0]?.toUpperCase() ?? '?';
  const tint = tints[identity ? tintIndex(identity, tints.length) : 0];

  return (
    <View
      className={cn(
        'items-center justify-center overflow-hidden rounded-full',
        tint.container,
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
        // Hidden from assistive technology: every caller already labels the row
        // or the button with the person's actual name, and a screen reader
        // announcing a lone letter beside it says nothing.
        <Text variant={dimensions.text} tone={tint.text} aria-hidden>
          {initial}
        </Text>
      )}
    </View>
  );
}
