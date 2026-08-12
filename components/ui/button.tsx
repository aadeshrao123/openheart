import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

const variants = {
  primary: {
    container: 'bg-brand active:bg-brand-pressed',
    tone: 'inverted',
  },
  secondary: {
    container: 'bg-surface-raised border border-border active:bg-surface',
    tone: 'default',
  },
  ghost: {
    container: 'bg-transparent active:bg-surface',
    tone: 'muted',
  },
  danger: {
    container: 'bg-danger-subtle active:opacity-80',
    tone: 'danger',
  },
} as const;

// sm is h-11 rather than h-10 because 44 is the floor, not a target. It is
// the size report, block, unmatch and the moderation verdicts all use.
const sizes = {
  sm: { container: 'h-11 px-4', text: 'label' },
  md: { container: 'h-13 px-6', text: 'label' },
  lg: { container: 'h-15 px-7', text: 'heading' },
} as const;

export type ButtonProps = Omit<PressableProps, 'children'> & {
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const appearance = variants[variant];
  const dimensions = sizes[size];
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      // aria-*, not accessibilityState: react-native-web reads only these and
      // drops the object form, so busy never reached a screen reader on web.
      aria-disabled={isDisabled}
      aria-busy={loading}
      disabled={isDisabled}
      className={cn(
        'flex-row items-center justify-center rounded-control',
        appearance.container,
        dimensions.container,
        isDisabled && 'opacity-40',
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text variant={dimensions.text} tone={appearance.tone} font="strong">
          {label}
        </Text>
      )}
    </Pressable>
  );
}
