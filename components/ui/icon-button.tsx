import { ActivityIndicator, Pressable, type PressableProps } from 'react-native';
import { Icon, type IconProps } from './icon';
import { cn } from '@/lib/cn';

type Variant = keyof typeof variants;
type Size = keyof typeof sizes;

// The two deck decisions are a shape and a colour rather than a word, which is
// how every app in this category draws them and how people already read them.
// The label does not disappear: it is the accessible name, so the control is
// still announced as "Like" and still reachable, it simply is not printed.
const variants = {
  like: {
    container: 'bg-brand hover:bg-brand-hover active:bg-brand-pressed',
    icon: 'text-fg-inverted',
    filled: true,
  },
  pass: {
    container:
      'border border-border bg-surface-raised hover:bg-surface-hover active:bg-surface-pressed',
    icon: 'text-fg-muted',
    filled: false,
  },
} as const;

// The like is the larger of the two. Equal weight reads as a question with two
// equally likely answers, which is not what the deck is asking.
const sizes = {
  md: { container: 'h-14 w-14', icon: 'md' },
  lg: { container: 'h-16 w-16', icon: 'lg' },
} as const;

export type IconButtonProps = Omit<PressableProps, 'children'> & {
  name: IconProps['name'];
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  className?: string;
};

export function IconButton({
  name,
  label,
  variant = 'like',
  size = 'lg',
  loading = false,
  disabled,
  className,
  ...props
}: IconButtonProps) {
  const base = variants[variant];
  const dimensions = sizes[size];
  const inert = disabled === true;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={inert || loading}
      aria-busy={loading}
      disabled={inert || loading}
      className={cn(
        'items-center justify-center rounded-full',
        inert ? 'border border-border bg-surface' : base.container,
        dimensions.container,
        className,
      )}
      {...props}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Icon
          name={name}
          size={dimensions.icon}
          filled={base.filled}
          className={inert ? 'text-fg-subtle' : base.icon}
        />
      )}
    </Pressable>
  );
}
