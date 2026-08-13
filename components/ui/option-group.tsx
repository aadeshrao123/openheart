import { View } from 'react-native';
import { Chip } from './chip';
import { Text } from './text';
import { cn } from '@/lib/cn';

export type Option = {
  value: string;
  label: string;
};

export type OptionGroupProps = {
  label: string;
  options: readonly Option[];
  hint?: string;
  className?: string;
};

export type SingleSelectProps = OptionGroupProps & {
  value: string | null;
  onChange: (value: string | null) => void;
};

export type MultiSelectProps = OptionGroupProps & {
  values: readonly string[];
  onChange: (values: string[]) => void;
  max?: number;
};

function Frame({ label, hint, children }: OptionGroupProps & { children: React.ReactNode }) {
  return (
    <View className="gap-3">
      <Text variant="overline" tone="subtle">
        {label}
      </Text>

      <View className="flex-row flex-wrap gap-2">{children}</View>

      {hint ? (
        <Text variant="caption" tone="subtle">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

// Tapping the selected chip clears it, because every one of these fields is
// optional and a radio group with no way back is a trap.
export function SingleSelect({ value, onChange, options, ...frame }: SingleSelectProps) {
  return (
    <Frame options={options} {...frame}>
      {options.map((option) => (
        <Chip
          key={option.value}
          mode="radio"
          label={option.label}
          selected={value === option.value}
          onPress={() => onChange(value === option.value ? null : option.value)}
        />
      ))}
    </Frame>
  );
}

export function MultiSelect({ values, onChange, options, max, ...frame }: MultiSelectProps) {
  const full = max !== undefined && values.length >= max;

  return (
    <Frame options={options} {...frame}>
      {options.map((option) => {
        const selected = values.includes(option.value);

        return (
          <Chip
            key={option.value}
            label={option.label}
            selected={selected}
            disabled={!selected && full}
            className={cn(!selected && full && 'opacity-40')}
            onPress={() =>
              onChange(
                selected ? values.filter((v) => v !== option.value) : [...values, option.value],
              )
            }
          />
        );
      })}
    </Frame>
  );
}
