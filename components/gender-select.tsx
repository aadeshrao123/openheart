import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chip, Text } from '@/components/ui';
import { GENDERS, type Gender } from '@/lib/profile-options';

// One file because it is the same list read two ways. Two components rather than
// one with a "multiple" flag, because the value types genuinely differ.

export type GenderSelectProps = {
  label: string;
  value: Gender | null;
  onChange: (value: Gender) => void;
};

export function GenderSelect({ label, value, onChange }: GenderSelectProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {label}
      </Text>

      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {GENDERS.map((gender) => (
          <Chip
            key={gender}
            mode="radio"
            label={t(`profile.gender_${gender}`)}
            selected={value === gender}
            onPress={() => onChange(gender)}
          />
        ))}
      </View>
    </View>
  );
}

export type SeekingSelectProps = {
  label: string;
  value: Gender[];
  onChange: (value: Gender[]) => void;
};

export function SeekingSelect({ label, value, onChange }: SeekingSelectProps) {
  const { t } = useTranslation();

  const toggle = (gender: Gender) => {
    onChange(
      value.includes(gender) ? value.filter((entry) => entry !== gender) : [...value, gender],
    );
  };

  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {label}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {GENDERS.map((gender) => (
          <Chip
            key={gender}
            label={t(`profile.gender_${gender}`)}
            selected={value.includes(gender)}
            onPress={() => toggle(gender)}
          />
        ))}
      </View>
    </View>
  );
}
