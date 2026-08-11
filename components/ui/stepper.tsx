import { Pressable, View } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

export type StepperProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (value: number) => string;
  decrementLabel: string;
  incrementLabel: string;
  onChange: (value: number) => void;
  className?: string;
};

// Not a slider: it takes its colours as JavaScript props, which would put a
// colour outside global.css. Not role="adjustable" either, which maps to
// role="slider" on web where accessibilityActions do not exist, leaving a
// screen reader a slider it cannot move. Two labelled buttons work everywhere.
export function Stepper({
  label,
  value,
  min,
  max,
  step = 1,
  formatValue,
  decrementLabel,
  incrementLabel,
  onChange,
  className,
}: StepperProps) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));

  return (
    <View className={cn('gap-2', className)}>
      <Text variant="label" tone="muted">
        {label}
      </Text>

      <View
        className={cn(
          'flex-row items-center justify-between p-1',
          'rounded-control border border-border bg-surface-raised',
        )}
      >
        <StepperButton
          label={decrementLabel}
          glyph="-"
          disabled={value <= min}
          onPress={() => onChange(clamp(value - step))}
        />

        {/* Announces the new value after a press, which two buttons alone
            would not. */}
        <Text variant="heading" aria-live="polite">
          {formatValue ? formatValue(value) : String(value)}
        </Text>

        <StepperButton
          label={incrementLabel}
          glyph="+"
          disabled={value >= max}
          onPress={() => onChange(clamp(value + step))}
        />
      </View>
    </View>
  );
}

type StepperButtonProps = {
  label: string;
  glyph: string;
  disabled: boolean;
  onPress: () => void;
};

function StepperButton({ label, glyph, disabled, onPress }: StepperButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-control',
        disabled ? 'opacity-30' : 'active:bg-surface',
      )}
    >
      {/* The glyph is decorative: the button already carries a real label. */}
      <Text variant="heading" tone={disabled ? 'subtle' : 'brand'} aria-hidden>
        {glyph}
      </Text>
    </Pressable>
  );
}
