import { View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Input, Screen, Text } from '@/components/ui';
import { GenderSelect, SeekingSelect } from '@/components/gender-select';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { useOnboardingDraft } from '@/lib/onboarding-draft';
import { BIO_MAX, DISPLAY_NAME_MAX } from '@/lib/profile-options';

export default function AboutYouScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const draft = useOnboardingDraft();

  // Reached by a reload or a back gesture that skipped step one, which would
  // otherwise try to insert a profile with no birthdate.
  if (!draft.birthdate) {
    return <Redirect href="/birthdate" />;
  }

  // Gender and seeking are nullable in the schema but required here: without
  // both, there is nobody to match this person with and no deck to put them in.
  const complete =
    draft.displayName.trim().length > 0 && draft.gender !== null && draft.seeking.length > 0;

  return (
    <Screen scroll className="gap-8 py-8">
      <OnboardingProgress step={2} />

      <View className="gap-3">
        <Text variant="title">{t('onboarding.about_you_title')}</Text>
        <Text tone="muted">{t('onboarding.about_you_body')}</Text>
      </View>

      <Input
        label={t('profile.display_name')}
        value={draft.displayName}
        onChangeText={(displayName) => draft.update({ displayName })}
        maxLength={DISPLAY_NAME_MAX}
        autoCapitalize="words"
        autoComplete="name"
        hint={t('onboarding.display_name_hint')}
      />

      <GenderSelect
        label={t('profile.gender')}
        value={draft.gender}
        onChange={(gender) => draft.update({ gender })}
      />

      <SeekingSelect
        label={t('profile.seeking')}
        value={draft.seeking}
        onChange={(seeking) => draft.update({ seeking })}
      />

      <Input
        label={t('profile.bio')}
        value={draft.bio}
        onChangeText={(bio) => draft.update({ bio })}
        maxLength={BIO_MAX}
        multiline
        numberOfLines={4}
        // h-auto so multiline is not squashed into the single-line height the
        // Input primitive sets, and py so the text is not against the border.
        className="h-auto min-h-24 py-3"
        hint={t('onboarding.bio_hint', { remaining: BIO_MAX - draft.bio.length })}
      />

      <View className="grow justify-end pt-2">
        <Button
          label={t('common.continue')}
          disabled={!complete}
          onPress={() => router.push('/preferences')}
        />
      </View>
    </Screen>
  );
}
