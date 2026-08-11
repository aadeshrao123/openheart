import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { BirthdateField, type BirthdateParts } from '@/components/birthdate-field';
import { OnboardingProgress } from '@/components/onboarding-progress';
import { isAdult, toBirthdate, toDateColumn, MINIMUM_AGE } from '@/lib/age';
import { useOnboardingDraft } from '@/lib/onboarding-draft';

const EMPTY_PARTS: BirthdateParts = { day: '', month: '', year: '' };

export default function BirthdateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const update = useOnboardingDraft((state) => state.update);

  const [parts, setParts] = useState<BirthdateParts>(EMPTY_PARTS);
  const [error, setError] = useState<string | null>(null);

  const complete = parts.day !== '' && parts.month !== '' && parts.year.length === 4;

  const submit = () => {
    const birthdate = toBirthdate(Number(parts.day), Number(parts.month), Number(parts.year));

    if (!birthdate) {
      setError(t('onboarding.birthdate_invalid'));
      return;
    }

    // The enforce_adult trigger would reject this anyway. Checking here is what
    // turns a database exception into a sentence the user can act on.
    if (!isAdult(birthdate)) {
      setError(t('onboarding.birthdate_too_young', { age: MINIMUM_AGE }));
      return;
    }

    setError(null);
    update({ birthdate: toDateColumn(birthdate) });
    router.push('/about-you');
  };

  return (
    <Screen scroll className="gap-10 py-8">
      <OnboardingProgress step={1} />

      <View className="gap-3">
        <Text variant="title">{t('onboarding.birthdate_title')}</Text>
        <Text tone="muted">{t('onboarding.birthdate_body')}</Text>
      </View>

      <BirthdateField
        value={parts}
        error={error ?? undefined}
        onChange={(next) => {
          setError(null);
          setParts(next);
        }}
      />

      <View className="grow justify-end gap-3">
        <Text variant="caption" tone="subtle">
          {t('onboarding.birthdate_locked_warning')}
        </Text>

        <Button label={t('common.continue')} disabled={!complete} onPress={submit} />
      </View>
    </Screen>
  );
}
