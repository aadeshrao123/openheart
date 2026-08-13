import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RangeSlider, Slider, Text } from '@/components/ui';
import { formatDistance, usesImperialUnits } from '@/lib/format';
import {
  AGE_CEILING,
  AGE_FLOOR,
  DISTANCE_MAX_KM,
  DISTANCE_MIN_KM,
  KM_PER_MILE_STEP,
} from '@/lib/profile-options';

export type DistancePreferenceProps = {
  value: number;
  onChange: (value: number) => void;
};

// A user in the US drags to 25 miles and a user in Germany drags to 25
// kilometres. Neither sees the other's unit, and neither sees a converted
// number, so the step is whichever unit is being read.
export function DistancePreference({ value, onChange }: DistancePreferenceProps) {
  const { t } = useTranslation();
  const step = usesImperialUnits() ? KM_PER_MILE_STEP : 1;

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text variant="label" tone="muted">
          {t('profile.distance_preference')}
        </Text>

        <Text variant="label" font="strong">
          {formatDistance(value)}
        </Text>
      </View>

      <Slider
        label={t('profile.distance_preference')}
        value={value}
        min={DISTANCE_MIN_KM}
        max={DISTANCE_MAX_KM}
        step={step}
        onChange={onChange}
      />
    </View>
  );
}

export type AgePreferenceProps = {
  min: number;
  max: number;
  onChange: (range: { ageMin: number; ageMax: number }) => void;
};

// The thumbs clamp against each other rather than validating afterwards.
// age_min <= age_max is a CHECK constraint, so an inverted range is not a
// warning to show, it is a write that fails.
export function AgePreference({ min, max, onChange }: AgePreferenceProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-2">
      <View className="flex-row items-baseline justify-between">
        <Text variant="label" tone="muted">
          {t('profile.age_preference')}
        </Text>

        <Text variant="label" font="strong">
          {t('profile.age_range', { min, max })}
        </Text>
      </View>

      <RangeSlider
        low={min}
        high={max}
        min={AGE_FLOOR}
        max={AGE_CEILING}
        lowLabel={t('profile.age_min')}
        highLabel={t('profile.age_max')}
        onChange={(ageMin, ageMax) => onChange({ ageMin, ageMax })}
      />
    </View>
  );
}
