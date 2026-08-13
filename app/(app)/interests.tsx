import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Screen, Section, Skeleton, Text } from '@/components/ui';
import { useMyProfile, useUpdateProfile } from '@/hooks/use-my-profile';
import { INTERESTS_MAX, INTEREST_GROUPS } from '@/lib/profile-options';

// Its own screen rather than a block on the edit form. Forty-four options
// inline turned that form into something nobody would scroll to the end of.
export default function InterestsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const updateProfile = useUpdateProfile();

  const [chosen, setChosen] = useState<string[] | null>(null);

  if (!profile) {
    return (
      <Screen scroll className="gap-6 py-8">
        <View accessibilityRole="progressbar" aria-busy className="gap-6">
          <Skeleton shape="title" className="w-1/2" />
          <Skeleton shape="block" />
          <Skeleton shape="block" />
        </View>
      </Screen>
    );
  }

  const current = chosen ?? profile.interests ?? [];
  const full = current.length >= INTERESTS_MAX;

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/edit-profile'));

  const toggle = (interest: string) =>
    setChosen(
      current.includes(interest)
        ? current.filter((entry) => entry !== interest)
        : [...current, interest],
    );

  const save = () =>
    updateProfile.mutate(
      { interests: current.length > 0 ? current : null },
      { onSuccess: leave },
    );

  return (
    <Screen scroll className="gap-8 py-8">
      <View className="gap-2">
        <Text variant="title">{t('profile.interests')}</Text>

        <Text tone="muted">
          {t('profile.interests_chosen', { count: current.length, max: INTERESTS_MAX })}
        </Text>
      </View>

      {INTEREST_GROUPS.map((group) => (
        <Section key={group.key} title={t(`profile.interest_group_${group.key}`)}>
          <View className="flex-row flex-wrap gap-2">
            {group.interests.map((interest) => {
              const selected = current.includes(interest);

              return (
                <Chip
                  key={interest}
                  label={t(`profile.interest_${interest}`)}
                  selected={selected}
                  disabled={!selected && full}
                  className={!selected && full ? 'opacity-40' : undefined}
                  onPress={() => toggle(interest)}
                />
              );
            })}
          </View>
        </Section>
      ))}

      <View className="gap-3">
        <Button label={t('common.done')} loading={updateProfile.isPending} onPress={save} />

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
