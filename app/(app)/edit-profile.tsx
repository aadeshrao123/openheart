import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Input, Screen, Skeleton, Text } from '@/components/ui';
import { GenderSelect, SeekingSelect } from '@/components/gender-select';
import { AgePreference, DistancePreference } from '@/components/preference-fields';
import { useMyProfile, useUpdateProfile } from '@/hooks/use-my-profile';
import { fromDateColumn } from '@/lib/age';
import { formatDate } from '@/lib/format';
import { BIO_MAX, DISPLAY_NAME_MAX, isGender, type Gender } from '@/lib/profile-options';

type Form = {
  displayName: string;
  gender: Gender | null;
  seeking: Gender[];
  bio: string;
  maxDistanceKm: number;
  ageMin: number;
  ageMax: number;
};

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const updateProfile = useUpdateProfile();

  // Seeded once from the loaded profile. Re-seeding on every render would fight
  // the user's typing, and the mutation writes the saved row back into the cache
  // anyway.
  const [form, setForm] = useState<Form | null>(null);

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
          <Skeleton shape="block" />
          <Skeleton shape="block" />
          <Skeleton shape="block" />
        </View>
      </Screen>
    );
  }

  const current: Form =
    form ?? {
      displayName: profile.display_name,
      gender: profile.gender !== null && isGender(profile.gender) ? profile.gender : null,
      seeking: profile.seeking.filter(isGender),
      bio: profile.bio ?? '',
      maxDistanceKm: profile.max_distance_km,
      ageMin: profile.age_min,
      ageMax: profile.age_max,
    };

  const patch = (next: Partial<Form>) => setForm({ ...current, ...next });

  const birthdate = fromDateColumn(profile.birthdate);
  const valid = current.displayName.trim().length > 0;

  const save = () => {
    updateProfile.mutate(
      {
        display_name: current.displayName.trim(),
        bio: current.bio.trim() === '' ? null : current.bio.trim(),
        gender: current.gender,
        seeking: current.seeking,
        max_distance_km: current.maxDistanceKm,
        age_min: current.ageMin,
        age_max: current.ageMax,
      },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen scroll className="gap-8 py-8">
      <Text variant="title">{t('home.edit_profile')}</Text>

      <Input
        label={t('profile.display_name')}
        value={current.displayName}
        onChangeText={(displayName) => patch({ displayName })}
        maxLength={DISPLAY_NAME_MAX}
        autoCapitalize="words"
      />

      {/* Shown, not editable. birthdate is absent from the update grant and a
          trigger rejects the change, so an input here could only ever fail.
          Displaying it makes the rule visible instead of mysterious. */}
      <Card elevation="flat" className="gap-1">
        <Text variant="label" tone="muted">
          {t('profile.birthdate')}
        </Text>
        <Text>{birthdate ? formatDate(birthdate) : profile.birthdate}</Text>
        <Text variant="caption" tone="subtle">
          {t('profile.birthdate_locked')}
        </Text>
      </Card>

      <GenderSelect
        label={t('profile.gender')}
        value={current.gender}
        onChange={(gender) => patch({ gender })}
      />

      <SeekingSelect
        label={t('profile.seeking')}
        value={current.seeking}
        onChange={(seeking) => patch({ seeking })}
      />

      <Input
        label={t('profile.bio')}
        value={current.bio}
        onChangeText={(bio) => patch({ bio })}
        maxLength={BIO_MAX}
        multiline
        numberOfLines={4}
        className="h-auto min-h-24 py-3"
        hint={t('onboarding.bio_hint', { remaining: BIO_MAX - current.bio.length })}
      />

      <DistancePreference
        value={current.maxDistanceKm}
        onChange={(maxDistanceKm) => patch({ maxDistanceKm })}
      />

      <AgePreference
        min={current.ageMin}
        max={current.ageMax}
        onChange={({ ageMin, ageMax }) => patch({ ageMin, ageMax })}
      />

      <View className="gap-3 pt-2">
        {updateProfile.isError ? (
          <Text variant="caption" tone="danger" role="alert">
            {t('common.error_generic')}
          </Text>
        ) : null}

        <Button
          label={t('common.save')}
          disabled={!valid}
          loading={updateProfile.isPending}
          onPress={save}
        />

        <Button variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
