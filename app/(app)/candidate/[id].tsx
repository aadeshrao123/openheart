import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Skeleton, Text } from '@/components/ui';
import { formatDistance } from '@/lib/format';
import { photoUrl } from '@/lib/photos';
import { useDiscovery } from '@/hooks/use-discovery';
import { ProfileDetails } from '@/components/profile-details';
import { SafetyActions } from '@/components/safety-actions';
import { VerifiedBadge } from '@/components/verified-badge';

// The photo, the name and distance under it, then the bio.
function CandidateSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="gap-6"
    >
      <Skeleton shape="card" />

      <View className="gap-2">
        <Skeleton shape="title" className="w-1/2" />
        <Skeleton shape="caption" className="w-1/3" />
      </View>

      <Skeleton shape="block" />
    </View>
  );
}

// Reads the candidate out of the deck's cache rather than fetching it. There is
// no "get one profile by id" route that would be safe to add: profiles_select_
// others would allow it, but a per-id lookup is exactly the shape of an
// enumeration endpoint, and discover_profiles already applied every filter this
// user is entitled to.
export default function CandidateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: deck, isPending } = useDiscovery();
  const [safetyOpen, setSafetyOpen] = useState(false);

  const candidate = deck?.find((entry) => entry.id === id);

  // An empty cache and a deck that has not loaded look the same from here, so
  // the redirect below has to wait for the query. A deep link opened cold used
  // to bounce straight back to the deck before the first fetch returned.
  if (isPending) {
    return (
      <Screen scroll className="gap-6 py-6">
        <CandidateSkeleton />
      </Screen>
    );
  }

  // Swiped, filtered out, or a link to somebody this user cannot be shown.
  // Going back to the deck is the honest answer rather than an error about a
  // person, and a deck that failed to load says so there.
  if (!candidate) {
    return <Redirect href="/deck" />;
  }

  return (
    <Screen scroll className="gap-6 py-6">
      <View className="aspect-card overflow-hidden rounded-card bg-surface">
        {candidate.photoKeys[0] ? (
          <Image
            source={{ uri: photoUrl(candidate.photoKeys[0], 'full') }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('profile.photo_alt', { name: candidate.display_name })}
          />
        ) : (
          <View className="flex-1 items-center justify-center bg-brand-subtle">
            <Text variant="display" tone="brand" aria-hidden>
              {candidate.display_name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View className="gap-2">
        <View className="flex-row items-center gap-3">
          <Text variant="title" className="flex-1">
            {t('deck.name_age', { name: candidate.display_name, age: candidate.age })}
          </Text>

          <VerifiedBadge />
        </View>

        <Text variant="label" tone="brand">
          {candidate.distance_bucket_km === 0
            ? t('deck.distance_very_close')
            : t('deck.distance_away', {
                distance: formatDistance(candidate.distance_bucket_km),
              })}
        </Text>
      </View>

      {candidate.bio ? (
        <Card elevation="flat">
          <Text>{candidate.bio}</Text>
        </Card>
      ) : null}

      <ProfileDetails profile={candidate} />

      {/* The remaining photos. The first is already the header above. */}
      {candidate.photoKeys.slice(1).map((key) => (
        <View key={key} className="aspect-card overflow-hidden rounded-card bg-surface">
          <Image
            source={{ uri: photoUrl(key, 'full') }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('profile.photo_alt', { name: candidate.display_name })}
          />
        </View>
      ))}

      {/* No like or pass here on purpose. Deciding from a detail view and
          deciding from the deck are two paths to the same write, and the deck
          owns the optimistic removal. */}
      <Button
        variant="ghost"
        size="sm"
        label={t('safety.title', { name: candidate.display_name })}
        onPress={() => setSafetyOpen(true)}
      />

      <Button
        variant="secondary"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/deck'))}
      />

      <SafetyActions
        visible={safetyOpen}
        name={candidate.display_name}
        targetId={candidate.id}
        onClose={() => setSafetyOpen(false)}
        onBlocked={() => router.replace('/deck')}
      />
    </Screen>
  );
}
