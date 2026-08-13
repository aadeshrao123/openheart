import { Pressable, View } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

type Tone = keyof typeof tones;

const tones = {
  default: 'default',
  danger: 'danger',
} as const;

export type ListRowProps = {
  label: string;
  value?: string;
  tone?: Tone;
  disabled?: boolean;
  onPress?: () => void;
  className?: string;
};

// Rows without an onPress are read-only, so they get no button role and stay
// out of the focus order rather than announcing an action that does not exist.
export function ListRow({
  label,
  value,
  tone = 'default',
  disabled = false,
  onPress,
  className,
}: ListRowProps) {
  const content = (
    <View className="min-h-11 flex-row items-center justify-between gap-4 py-3">
      <Text tone={tones[tone]}>{label}</Text>

      {value ? (
        <Text tone="muted" numberOfLines={1} className="shrink">
          {value}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) {
    return <View className={cn('px-4', className)}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'px-4 hover:bg-surface-hover active:bg-surface-pressed',
        disabled && 'opacity-50',
        className,
      )}
    >
      {content}
    </Pressable>
  );
}
