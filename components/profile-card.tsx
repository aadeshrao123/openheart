import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDistance } from '@/lib/format';
import { photoUrl } from '@/lib/photos';
import type { Candidate } from '@/hooks/use-discovery';

export type ProfileCardProps = {
  candidate: Candidate;
  onPress?: () => void;
  className?: string;
};

export function ProfileCard({ candidate, onPress, className }: ProfileCardProps) {
  const { t } = useTranslation();
  const photoKey = candidate.photoKeys[0];

  // Pressable only when it leads somewhere. The cards stacked behind the top one
  // are passed no handler, so they never become a tap target a screen reader
  // would offer.
  const Container = onPress ? Pressable : View;

  return (
    <Container
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={
        onPress ? t('deck.open_profile', { name: candidate.display_name }) : undefined
      }
      onPress={onPress}
      className={cn(
        'flex-1 overflow-hidden rounded-card border border-border bg-surface-raised',
        'shadow-lg shadow-shadow/10',
        className,
      )}
    >
      <View className="flex-1 bg-surface">
        {photoKey ? (
          <Image
            source={{ uri: photoUrl(photoKey, 'medium') }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('profile.photo_alt', { name: candidate.display_name })}
          />
        ) : (
          // Every profile lands here today: nothing can reach approved without a
          // CSAM provider, so there is no photo to fetch. The initial keeps the
          // deck legible instead of showing a column of empty rectangles.
          <View className="flex-1 items-center justify-center bg-brand-subtle">
            <Text variant="monogram" tone="brand" aria-hidden>
              {candidate.display_name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View className="gap-2.5 p-5">
        {/* One key, not a name concatenated with an age: word order and
            punctuation between the two differ by language. */}
        <Text variant="title" numberOfLines={1}>
          {t('deck.name_age', { name: candidate.display_name, age: candidate.age })}
        </Text>

        {/* Bucket zero means nearer than the smallest 5km bucket, not zero. */}
        <Text variant="overline" tone="accent">
          {candidate.distance_bucket_km === 0
            ? t('deck.distance_very_close')
            : t('deck.distance_away', {
                distance: formatDistance(candidate.distance_bucket_km),
              })}
        </Text>

        {candidate.bio ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {candidate.bio}
          </Text>
        ) : null}
      </View>
    </Container>
  );
}
