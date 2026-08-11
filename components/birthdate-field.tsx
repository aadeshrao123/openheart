import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Input, Text } from '@/components/ui';

export type BirthdateParts = {
  day: string;
  month: string;
  year: string;
};

export type BirthdateFieldProps = {
  value: BirthdateParts;
  onChange: (value: BirthdateParts) => void;
  error?: string;
};

type PartName = 'day' | 'month' | 'year';

// Three fields rather than a picker: no native date picker works on web, and
// scrolling back 30 years to a birth year is worse than typing it.
//
// The order comes from Intl because it differs by locale, and hardcoding one
// would silently collect wrong dates on the one field nobody can correct later.
function localePartOrder(locale: string): PartName[] {
  const parts = new Intl.DateTimeFormat(locale).formatToParts(new Date());

  const order = parts
    .map((part) => part.type)
    .filter((type): type is PartName => type === 'day' || type === 'month' || type === 'year');

  return order.length === 3 ? order : ['day', 'month', 'year'];
}

export function BirthdateField({ value, onChange, error }: BirthdateFieldProps) {
  const { t, i18n } = useTranslation();
  const order = useMemo(() => localePartOrder(i18n.language), [i18n.language]);

  const fields: Record<PartName, { label: string; length: number; grow: string }> = {
    day: { label: t('onboarding.day'), length: 2, grow: 'flex-[2]' },
    month: { label: t('onboarding.month'), length: 2, grow: 'flex-[2]' },
    year: { label: t('onboarding.year'), length: 4, grow: 'flex-[3]' },
  };

  return (
    <View className="gap-2">
      <View className="flex-row gap-3">
        {order.map((part) => (
          <Input
            key={part}
            label={fields[part].label}
            value={value[part]}
            onChangeText={(next) =>
              onChange({ ...value, [part]: next.replace(/\D/g, '').slice(0, fields[part].length) })
            }
            keyboardType="number-pad"
            maxLength={fields[part].length}
            containerClassName={fields[part].grow}
            className="text-center"
          />
        ))}
      </View>

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
