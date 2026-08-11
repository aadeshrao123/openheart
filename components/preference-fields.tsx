import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Chip, Stepper, Text } from '@/components/ui';
import { formatDistance, usesImperialUnits } from '@/lib/format';
import { AGE_CEILING, AGE_FLOOR, distancePresetsKm } from '@/lib/profile-options';

export type DistancePreferenceProps = {
  value: number;
  onChange: (value: number) => void;
};

// A user in the US picks 25 miles and a user in Germany picks 25 kilometres.
// Neither sees the other's unit, and neither sees a converted number.
export function DistancePreference({ value, onChange }: DistancePreferenceProps) {
  const { t } = useTranslation();
  const presets = distancePresetsKm(usesImperialUnits());

  return (
    <View className="gap-2">
      <Text variant="label" tone="muted">
        {t('profile.distance_preference')}
      </Text>

      <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
        {presets.map((kilometres) => (
          <Chip
            key={kilometres}
            mode="radio"
            label={formatDistance(kilometres)}
            selected={value === kilometres}
            onPress={() => onChange(kilometres)}
          />
        ))}
      </View>
    </View>
  );
}

export type AgePreferenceProps = {
  min: number;
  max: number;
  onChange: (range: { ageMin: number; ageMax: number }) => void;
};

// The two steppers clamp against each other rather than validating afterwards.
// age_min <= age_max is a CHECK constraint, so an inverted range is not a
// warning to show, it is a write that fails.
export function AgePreference({ min, max, onChange }: AgePreferenceProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      <Text variant="label" tone="muted">
        {t('profile.age_preference')}
      </Text>

      <Stepper
        label={t('profile.age_min')}
        value={min}
        min={AGE_FLOOR}
        max={max}
        decrementLabel={t('profile.age_min_decrease')}
        incrementLabel={t('profile.age_min_increase')}
        onChange={(next) => onChange({ ageMin: next, ageMax: max })}
      />

      <Stepper
        label={t('profile.age_max')}
        value={max}
        min={min}
        max={AGE_CEILING}
        decrementLabel={t('profile.age_max_decrease')}
        incrementLabel={t('profile.age_max_increase')}
        onChange={(next) => onChange({ ageMin: min, ageMax: next })}
      />
    </View>
  );
}
