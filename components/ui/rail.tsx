import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

type Tone = keyof typeof tones;

const tones = {
  accent: 'bg-accent',
  border: 'bg-border',
  danger: 'bg-danger',
} as const;

export type RailProps = ViewProps & {
  tone?: Tone;
  className?: string;
};

// A vertical rule down the starting edge, drawn as a sibling View rather than
// as border-s-2.
//
// border-s-2 looks like the logical property and is not one on native.
// NativeWind hands border-inline-start-width to react-native-css-interop, which
// converts it to border-left-width (css-to-rn/parseDeclaration.ts, the
// border-inline-start-width case). That is physical and does not flip, while
// the ps- beside it becomes padding-start, which does. Under RTL the rule stayed
// on the left and its padding moved to the right, so the two ended up on
// opposite sides of the text with the rule cutting through the previous block.
//
// flex-row does flip, so this does.
export function Rail({ tone = 'accent', className, children, ...props }: RailProps) {
  return (
    <View className="flex-row" {...props}>
      <View className={cn('w-0.5', tones[tone])} />

      {/* ps-5 is the default gap between rule and text; a caller passing its own
          ps- in className replaces it, because cn resolves the conflict. */}
      <View className={cn('flex-1 ps-5', className)}>{children}</View>
    </View>
  );
}
