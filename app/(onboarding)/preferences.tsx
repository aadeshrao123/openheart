import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { AgePreference, DistancePreference } from '@/components/preference-fields';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { useCreateProfile } from '@/hooks/use-my-profile';
import { useOnboardingDraft } from '@/lib/onboarding-draft';

export default function PreferencesScreen() {
  const { t } = useTranslation();
  const draft = useOnboardingDraft();
  const createProfile = useCreateProfile();

  if (!draft.birthdate) {
    return <Redirect href="/birthdate" />;
  }

  const birthdate = draft.birthdate;

  const finish = () => {
    createProfile.mutate(
      {
        display_name: draft.displayName.trim(),
        birthdate,
        // An empty bio is absence of a bio, not a bio that is the empty string.
        bio: draft.bio.trim() === '' ? null : draft.bio.trim(),
        gender: draft.gender,
        seeking: draft.seeking,
        max_distance_km: draft.maxDistanceKm,
        age_min: draft.ageMin,
        age_max: draft.ageMax,
      },
      {
        // The draft holds a birthdate, so it is cleared as soon as it is no
        // longer needed rather than left in memory for the rest of the session.
        // Writing the row flips the gate to ready, and the onboarding layout
        // redirects out of the flow.
        onSuccess: () => draft.reset(),
      },
    );
  };

  return (
    <Screen scroll className="gap-8 py-8">
      <OnboardingProgress step={3} />

      <View className="gap-3">
        <Text variant="title">{t('onboarding.preferences_title')}</Text>
        <Text tone="muted">{t('onboarding.preferences_body')}</Text>
      </View>

      <DistancePreference
        value={draft.maxDistanceKm}
        onChange={(maxDistanceKm) => draft.update({ maxDistanceKm })}
      />

      <AgePreference
        min={draft.ageMin}
        max={draft.ageMax}
        onChange={({ ageMin, ageMax }) => draft.update({ ageMin, ageMax })}
      />

      <View className="grow justify-end gap-3 pt-2">
        {createProfile.isError ? (
          <Text variant="caption" tone="danger">
            {t('common.error_generic')}
          </Text>
        ) : null}

        <Button
          label={t('onboarding.finish')}
          loading={createProfile.isPending}
          onPress={finish}
        />

        <Text variant="caption" tone="subtle">
          {t('onboarding.preferences_changeable')}
        </Text>
      </View>
    </Screen>
  );
}
