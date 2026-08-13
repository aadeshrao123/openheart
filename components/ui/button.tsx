import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

// Each variant carries its own disabled appearance rather than sharing an
// opacity. A brand fill at 40% over a dark background is a muddy rectangle with
// an unreadable label, which reads as a broken control rather than an
// unavailable one, and that was the first thing anyone saw on the sign-in
// screen because the send button starts empty and therefore starts disabled.
const variants = {
  primary: {
    container: 'bg-brand hover:bg-brand-hover active:bg-brand-pressed',
    tone: 'inverted',
    disabled: { container: 'bg-surface border border-border', tone: 'subtle' },
  },
  secondary: {
    container:
      'bg-surface-raised border border-border hover:bg-surface-hover active:bg-surface-pressed',
    tone: 'default',
    disabled: { container: 'bg-surface border border-border', tone: 'subtle' },
  },
  ghost: {
    container: 'bg-transparent hover:bg-surface-hover active:bg-surface-pressed',
    tone: 'muted',
    disabled: { container: 'bg-transparent', tone: 'subtle' },
  },
  danger: {
    container: 'bg-danger-subtle hover:bg-danger-subtle-hover active:bg-danger-subtle-hover',
    tone: 'danger',
    disabled: { container: 'bg-surface border border-border', tone: 'subtle' },
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
  // A mark drawn before the label, for the provider buttons. Decorative: the
  // label already says which provider it is, so it carries no separate name.
  leading?: ReactNode;
  className?: string;
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  leading,
  disabled,
  className,
  ...props
}: ButtonProps) {
  const base = variants[variant];
  const dimensions = sizes[size];

  // Only an explicit disabled takes the disabled appearance. A button that
  // greys out the moment it is pressed looks like it refused the press.
  const inert = disabled === true;
  const appearance = inert ? base.disabled : base;

  return (
    <Pressable
      accessibilityRole="button"
      // aria-*, not accessibilityState: react-native-web reads only these and
      // drops the object form, so busy never reached a screen reader on web.
      aria-disabled={inert || loading}
      aria-busy={loading}
      disabled={inert || loading}
      className={cn(
        'flex-row items-center justify-center gap-3 rounded-control',
        appearance.container,
        dimensions.container,
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <>
          {leading ? <View aria-hidden>{leading}</View> : null}

          <Text variant={dimensions.text} tone={appearance.tone} font="strong">
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
