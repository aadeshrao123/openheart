import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { AgePreference, DistancePreference } from '@/components/preference-fields';
import { useMyProfile, useUpdateProfile } from '@/hooks/use-my-profile';
import { discoveryKey } from '@/hooks/use-discovery';

// Separate from edit-profile on purpose. These are the only fields that change
// who is in the deck, and the moment a user wants them is when the deck just ran
// out, which is the wrong time to send them into a form about their own bio.
export default function FiltersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [maxDistanceKm, setMaxDistanceKm] = useState(profile?.max_distance_km ?? 50);
  const [ageMin, setAgeMin] = useState(profile?.age_min ?? 18);
  const [ageMax, setAgeMax] = useState(profile?.age_max ?? 99);

  // The layout gate guarantees a profile before this renders.
  if (!profile) {
    return null;
  }

  // back() is a no-op when this was opened directly rather than pushed from the
  // deck, which strands the user on a screen with no way out.
  const leave = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/deck');
  };

  const unchanged =
    maxDistanceKm === profile.max_distance_km &&
    ageMin === profile.age_min &&
    ageMax === profile.age_max;

  const save = () => {
    updateProfile.mutate(
      { max_distance_km: maxDistanceKm, age_min: ageMin, age_max: ageMax },
      {
        onSuccess: () => {
          // The deck was built from the old limits, so it is wrong the moment
          // these change. Removing it means the next visit refetches rather
          // than showing a stale set of people the filters now exclude.
          queryClient.removeQueries({ queryKey: discoveryKey });
          leave();
        },
      },
    );
  };

  return (
    <Screen scroll className="gap-8 py-8">
      <View className="gap-3">
        <Text variant="title">{t('filters.title')}</Text>
        <Text tone="muted">{t('filters.body')}</Text>
      </View>

      <DistancePreference value={maxDistanceKm} onChange={setMaxDistanceKm} />

      <AgePreference
        min={ageMin}
        max={ageMax}
        onChange={(next) => {
          setAgeMin(next.ageMin);
          setAgeMax(next.ageMax);
        }}
      />

      <View className="gap-3">
        <Button
          label={t('filters.apply')}
          loading={updateProfile.isPending}
          disabled={unchanged}
          onPress={save}
        />

        <Button variant="ghost" label={t('common.cancel')} onPress={leave} />
      </View>

      {updateProfile.isError ? (
        <Text variant="caption" tone="danger">
          {t('common.error_generic')}
        </Text>
      ) : null}
    </Screen>
  );
}
