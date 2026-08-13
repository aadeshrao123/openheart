import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Chip,
  MultiSelect,
  Screen,
  Section,
  Skeleton,
  Slider,
  Text,
} from '@/components/ui';
import { AgePreference, DistancePreference } from '@/components/preference-fields';
import { useMyProfile, useUpdateProfile } from '@/hooks/use-my-profile';
import { discoveryKey } from '@/hooks/use-discovery';
import { formatHeight } from '@/lib/format';
import {
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  INTERESTS,
  INTERESTS_MAX,
  RELATIONSHIP_INTENTS,
} from '@/lib/profile-options';

type Filters = {
  maxDistanceKm: number;
  ageMin: number;
  ageMax: number;
  intents: string[];
  interests: string[];
  heightMin: number | null;
  heightMax: number | null;
  hasBio: boolean;
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
    intents: profile.filter_intents ?? [],
    interests: profile.filter_interests ?? [],
    heightMin: profile.filter_height_min_cm,
    heightMax: profile.filter_height_max_cm,
    hasBio: profile.filter_has_bio,
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

  const list = (values: string[]) => (values.length > 0 ? values : null);

  const clearAll = () =>
    patch({ intents: [], interests: [], heightMin: null, heightMax: null, hasBio: false });

  const narrowed =
    current.intents.length > 0 ||
    current.interests.length > 0 ||
    current.heightMin !== null ||
    current.heightMax !== null ||
    current.hasBio;

  const save = () => {
    updateProfile.mutate(
      {
        max_distance_km: current.maxDistanceKm,
        age_min: current.ageMin,
        age_max: current.ageMax,
        filter_intents: list(current.intents),
        filter_interests: list(current.interests),
        filter_height_min_cm: current.heightMin,
        filter_height_max_cm: current.heightMax,
        filter_has_bio: current.hasBio,
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
    <Screen scroll className="gap-10 py-8">
      <View className="gap-3">
        <Text variant="title">{t('filters.title')}</Text>
        <Text tone="muted">{t('filters.body')}</Text>
      </View>

      <Section title={t('filters.section_reach')}>
        <DistancePreference
          value={current.maxDistanceKm}
          onChange={(maxDistanceKm) => patch({ maxDistanceKm })}
        />

        <AgePreference min={current.ageMin} max={current.ageMax} onChange={(next) => patch(next)} />
      </Section>

      <Section title={t('filters.section_looking')} description={t('filters.optional')}>
        <MultiSelect
          label={t('profile.relationship_intent')}
          values={current.intents}
          onChange={(intents) => patch({ intents })}
          options={RELATIONSHIP_INTENTS.map((value) => ({
            value,
            label: t(`profile.intent_${value}`),
          }))}
        />
      </Section>

      <Section title={t('filters.section_height')} description={t('filters.optional')}>
        <View className="flex-row items-center justify-between">
          <Text variant="overline" tone="subtle">
            {t('filters.height_range')}
          </Text>

          <Text variant="label" font="strong">
            {current.heightMin === null && current.heightMax === null
              ? t('profile.unset')
              : t('profile.age_range', {
                  min: formatHeight(current.heightMin ?? HEIGHT_MIN_CM),
                  max: formatHeight(current.heightMax ?? HEIGHT_MAX_CM),
                })}
          </Text>
        </View>

        <Slider
          label={t('filters.height_min')}
          value={current.heightMin ?? HEIGHT_MIN_CM}
          min={HEIGHT_MIN_CM}
          max={HEIGHT_MAX_CM}
          onChange={(heightMin) =>
            patch({ heightMin, heightMax: Math.max(heightMin, current.heightMax ?? HEIGHT_MAX_CM) })
          }
        />

        <Slider
          label={t('filters.height_max')}
          value={current.heightMax ?? HEIGHT_MAX_CM}
          min={HEIGHT_MIN_CM}
          max={HEIGHT_MAX_CM}
          onChange={(heightMax) =>
            patch({ heightMax, heightMin: Math.min(heightMax, current.heightMin ?? HEIGHT_MIN_CM) })
          }
        />
      </Section>

      <Section title={t('filters.section_interests')} description={t('filters.optional')}>
        <MultiSelect
          label={t('profile.interests')}
          values={current.interests}
          max={INTERESTS_MAX}
          onChange={(interests) => patch({ interests })}
          options={INTERESTS.map((value) => ({
            value,
            label: t(`profile.interest_${value}`),
          }))}
        />
      </Section>

      <Section title={t('filters.section_profile')} description={t('filters.optional')}>
        <Chip
          mode="checkbox"
          label={t('filters.has_bio')}
          selected={current.hasBio}
          onPress={() => patch({ hasBio: !current.hasBio })}
          className="self-start"
        />
      </Section>

      <View className="gap-3">
        <Button label={t('filters.apply')} loading={updateProfile.isPending} onPress={save} />

        {narrowed ? (
          <Button variant="secondary" label={t('filters.clear')} onPress={clearAll} />
        ) : null}

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
