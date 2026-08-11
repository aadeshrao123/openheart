import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

type Shape = keyof typeof shapes;

// Named after what they stand in for rather than their dimensions, so a screen
// says what is coming and this file decides how big that is.
const shapes = {
  line: 'h-4 rounded-control',
  caption: 'h-3 rounded-control',
  heading: 'h-6 rounded-control',
  title: 'h-8 rounded-control',
  avatar: 'h-12 w-12 rounded-full',
  bubble: 'h-10 rounded-bubble',
  card: 'aspect-card rounded-card',
  block: 'h-28 rounded-card',
} as const;

export type SkeletonProps = ViewProps & {
  shape?: Shape;
  className?: string;
};

// Deliberately still. A shimmer is the pattern every gamified app uses, and the
// design direction here is the opposite of that one; a placeholder that pulses
// draws the eye to the fact that nothing has loaded. Shape is what does the
// work: a block the size of the thing that is coming reads as loading, where a
// centred word reads as an empty screen.
//
// aria-hidden throughout. A screen reader gets one "loading" from the region
// these sit in, not one per brick. Screens are responsible for that region.
export function Skeleton({ shape = 'line', className, ...props }: SkeletonProps) {
  return (
    <View aria-hidden className={cn('bg-surface', shapes[shape], className)} {...props} />
  );
}
