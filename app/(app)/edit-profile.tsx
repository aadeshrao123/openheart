import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Card,
  Input,
  MultiSelect,
  Screen,
  Section,
  SingleSelect,
  Skeleton,
  Slider,
  Text,
} from '@/components/ui';
import { GenderSelect, SeekingSelect } from '@/components/gender-select';
import { AgePreference, DistancePreference } from '@/components/preference-fields';
import { PromptEditor } from '@/components/prompt-editor';
import { useMyProfile, useUpdateProfile } from '@/hooks/use-my-profile';
import { usePrompts, useSavePrompts, type PromptAnswer } from '@/hooks/use-prompts';
import { useSession } from '@/hooks/use-session';
import { fromDateColumn } from '@/lib/age';
import { formatDate, formatHeight } from '@/lib/format';
import {
  BIO_MAX,
  CHILDREN_OPTIONS,
  DISPLAY_NAME_MAX,
  EDUCATION_LEVELS,
  HEIGHT_MAX_CM,
  HEIGHT_MIN_CM,
  INTERESTS,
  INTERESTS_MAX,
  JOB_TITLE_MAX,
  LIFESTYLE_FIELDS,
  LIFESTYLE_FREQUENCIES,
  RELATIONSHIP_INTENTS,
  isGender,
  type Gender,
} from '@/lib/profile-options';

type Form = {
  displayName: string;
  gender: Gender | null;
  seeking: Gender[];
  bio: string;
  maxDistanceKm: number;
  ageMin: number;
  ageMax: number;
  heightCm: number | null;
  relationshipIntent: string | null;
  drinking: string | null;
  smoking: string | null;
  exercise: string | null;
  children: string | null;
  education: string | null;
  jobTitle: string;
  interests: string[];
};

const options = (values: readonly string[], label: (value: string) => string) =>
  values.map((value) => ({ value, label: label(value) }));

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: profile } = useMyProfile();
  const { data: saved } = usePrompts(session?.user.id);
  const updateProfile = useUpdateProfile();
  const savePrompts = useSavePrompts();

  // Seeded once from the loaded profile. Re-seeding on every render would fight
  // the user's typing, and the mutation writes the saved row back to the cache.
  const [form, setForm] = useState<Form | null>(null);
  const [prompts, setPrompts] = useState<PromptAnswer[] | null>(null);

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
      heightCm: profile.height_cm,
      relationshipIntent: profile.relationship_intent,
      drinking: profile.drinking,
      smoking: profile.smoking,
      exercise: profile.exercise,
      children: profile.children,
      education: profile.education,
      jobTitle: profile.job_title ?? '',
      interests: profile.interests ?? [],
    };

  const answers = prompts ?? saved ?? [];
  const patch = (next: Partial<Form>) => setForm({ ...current, ...next });

  const birthdate = fromDateColumn(profile.birthdate);
  const valid = current.displayName.trim().length > 0;
  const busy = updateProfile.isPending || savePrompts.isPending;
  const failed = updateProfile.isError || savePrompts.isError;

  const trimmed = (value: string) => (value.trim() === '' ? null : value.trim());

  const save = () => {
    updateProfile.mutate(
      {
        display_name: current.displayName.trim(),
        bio: trimmed(current.bio),
        gender: current.gender,
        seeking: current.seeking,
        max_distance_km: current.maxDistanceKm,
        age_min: current.ageMin,
        age_max: current.ageMax,
        height_cm: current.heightCm,
        relationship_intent: current.relationshipIntent,
        drinking: current.drinking,
        smoking: current.smoking,
        exercise: current.exercise,
        children: current.children,
        education: current.education,
        job_title: trimmed(current.jobTitle),
        interests: current.interests.length > 0 ? current.interests : null,
      },
      {
        onSuccess: () => savePrompts.mutate(answers, { onSuccess: () => router.back() }),
      },
    );
  };

  return (
    <Screen scroll className="gap-10 py-8">
      <Text variant="title">{t('home.edit_profile')}</Text>

      <Section title={t('profile.section_basics')}>
        <Input
          label={t('profile.display_name')}
          value={current.displayName}
          onChangeText={(displayName) => patch({ displayName })}
          maxLength={DISPLAY_NAME_MAX}
          autoCapitalize="words"
        />

        {/* Shown, not editable. birthdate is absent from the update grant and a
            trigger rejects the change, so an input here could only ever fail. */}
        <Card elevation="flat" className="gap-1">
          <Text variant="label" tone="muted">
            {t('profile.birthdate')}
          </Text>
          <Text>{birthdate ? formatDate(birthdate) : profile.birthdate}</Text>
          <Text variant="caption" tone="subtle">
            {t('profile.birthdate_locked')}
          </Text>
        </Card>

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

        <GenderSelect
          label={t('profile.gender')}
          value={current.gender}
          onChange={(gender) => patch({ gender })}
        />
      </Section>

      <Section title={t('profile.section_about')} description={t('profile.section_about_body')}>
        <View className="gap-2">
          <View className="flex-row items-baseline justify-between">
            <Text variant="overline" tone="subtle">
              {t('profile.height')}
            </Text>

            <Text variant="label" font="strong">
              {current.heightCm === null ? t('profile.unset') : formatHeight(current.heightCm)}
            </Text>
          </View>

          <Slider
            label={t('profile.height')}
            value={current.heightCm ?? 170}
            min={HEIGHT_MIN_CM}
            max={HEIGHT_MAX_CM}
            onChange={(heightCm) => patch({ heightCm })}
          />
        </View>

        <Input
          label={t('profile.job_title')}
          value={current.jobTitle}
          onChangeText={(jobTitle) => patch({ jobTitle })}
          maxLength={JOB_TITLE_MAX}
          placeholder={t('profile.job_title_placeholder')}
        />

        <SingleSelect
          label={t('profile.education')}
          value={current.education}
          onChange={(education) => patch({ education })}
          options={options(EDUCATION_LEVELS, (value) => t(`profile.education_${value}`))}
        />

        <SingleSelect
          label={t('profile.relationship_intent')}
          value={current.relationshipIntent}
          onChange={(relationshipIntent) => patch({ relationshipIntent })}
          options={options(RELATIONSHIP_INTENTS, (value) => t(`profile.intent_${value}`))}
        />

        <SingleSelect
          label={t('profile.children')}
          value={current.children}
          onChange={(children) => patch({ children })}
          options={options(CHILDREN_OPTIONS, (value) => t(`profile.children_${value}`))}
        />
      </Section>

      <Section title={t('profile.section_lifestyle')}>
        {LIFESTYLE_FIELDS.map(({ field, label }) => (
          <SingleSelect
            key={field}
            label={t(label)}
            value={current[field]}
            onChange={(value) => patch({ [field]: value })}
            options={options(LIFESTYLE_FREQUENCIES, (value) => t(`profile.frequency_${value}`))}
          />
        ))}
      </Section>

      <Section
        title={t('profile.section_interests')}
        description={t('profile.interests_hint', { max: INTERESTS_MAX })}
      >
        <MultiSelect
          label={t('profile.interests')}
          values={current.interests}
          max={INTERESTS_MAX}
          onChange={(interests) => patch({ interests })}
          options={options(INTERESTS, (value) => t(`profile.interest_${value}`))}
        />
      </Section>

      <Section title={t('profile.section_prompts')} description={t('profile.prompts_hint')}>
        <PromptEditor value={answers} onChange={setPrompts} />
      </Section>

      <Section title={t('profile.section_who')} description={t('profile.section_who_body')}>
        <SeekingSelect
          label={t('profile.seeking')}
          value={current.seeking}
          onChange={(seeking) => patch({ seeking })}
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
      </Section>

      <View className="gap-3 pt-2">
        {failed ? (
          <Text variant="caption" tone="danger" role="alert">
            {t('common.error_generic')}
          </Text>
        ) : null}

        <Button label={t('common.save')} disabled={!valid} loading={busy} onPress={save} />

        <Button variant="ghost" label={t('common.cancel')} onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
