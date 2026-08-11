import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Skeleton, Text } from '@/components/ui';
import { AgePreference, DistancePreference } from '@/components/preference-fields';
import { useMyProfile, useUpdateProfile } from '@/hooks/use-my-profile';
import { discoveryKey } from '@/hooks/use-discovery';

type Filters = {
  maxDistanceKm: number;
  ageMin: number;
  ageMax: number;
};

// Separate from edit-profile on purpose. These are the only fields that change
// who is in the deck, and the moment a user wants them is when the deck just ran
// out, which is the wrong time to send them into a form about their own bio.
export default function FiltersScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile } = useMyProfile();
  const updateProfile = useUpdateProfile();

  // Seeded from the loaded profile below rather than in this initializer. A
  // default seeded before the row arrived would read as the user's own choice
  // and save over it, which is worse than the blank screen it guards against.
  const [form, setForm] = useState<Filters | null>(null);

  // The layout gate resolves the profile before this renders, so no path gets
  // here without one. It loads rather than returning null anyway: if that ever
  // stops holding, a blank screen is the one failure a user cannot act on.
  if (!profile) {
    return (
      <Screen scroll className="gap-8 py-8">
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t('common.loading')}
          aria-busy
          className="gap-8"
        >
          <Skeleton shape="title" className="w-1/2" />
          <Skeleton shape="caption" className="w-3/4" />
          <Skeleton shape="block" />
          <Skeleton shape="block" />
        </View>
      </Screen>
    );
  }

  const current: Filters = form ?? {
    maxDistanceKm: profile.max_distance_km,
    ageMin: profile.age_min,
    ageMax: profile.age_max,
  };

  const patch = (next: Partial<Filters>) => setForm({ ...current, ...next });

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
    current.maxDistanceKm === profile.max_distance_km &&
    current.ageMin === profile.age_min &&
    current.ageMax === profile.age_max;

  const save = () => {
    updateProfile.mutate(
      {
        max_distance_km: current.maxDistanceKm,
        age_min: current.ageMin,
        age_max: current.ageMax,
      },
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

      <DistancePreference
        value={current.maxDistanceKm}
        onChange={(maxDistanceKm) => patch({ maxDistanceKm })}
      />

      <AgePreference
        min={current.ageMin}
        max={current.ageMax}
        onChange={(next) => patch(next)}
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
        <Text variant="caption" tone="danger" role="alert">
          {t('common.error_generic')}
        </Text>
      ) : null}
    </Screen>
  );
}
