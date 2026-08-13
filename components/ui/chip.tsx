import { Pressable, type PressableProps } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

type Mode = 'checkbox' | 'radio';

export type ChipProps = Omit<PressableProps, 'children'> & {
  label: string;
  selected?: boolean;
  mode?: Mode;
  className?: string;
};

// aria-checked, not accessibilityState: react-native-web reads only aria-* and
// drops the object form, so selection reached a screen reader as nothing. React
// Native merges aria-* back the other way, so one prop covers both.
//
// checkbox and radio rather than button: aria-selected is invalid on a button.
export function Chip({
  label,
  selected = false,
  mode = 'checkbox',
  className,
  ...props
}: ChipProps) {
  return (
    <Pressable
      accessibilityRole={mode}
      aria-checked={selected}
      className={cn(
        'min-h-11 items-center justify-center rounded-control border px-4',
        selected
          ? 'border-brand bg-brand-subtle'
          : 'border-border bg-surface-raised hover:bg-surface-hover active:bg-surface-pressed',
        className,
      )}
      {...props}
    >
      <Text variant="label" tone={selected ? 'brand' : 'default'}>
        {label}
      </Text>
    </Pressable>
  );
}
