import { View } from 'react-native';
import { cn } from '@/lib/cn';

// A gradient without a gradient. expo-linear-gradient takes its colours as
// JavaScript strings, which is a colour outside global.css, and the CSS
// gradient in global.css is web only. So the fade is bands of the background
// token at rising opacity: it resolves through the same token in both themes
// and behaves identically on iOS, Android and web.
//
// Every step is on Tailwind's own opacity scale. The first attempt used 8, 34
// and 66, none of which are, and Tailwind emitted nothing for them: the scrim
// was fully transparent and the name sat on a bare photograph. A class that
// compiles to nothing fails silently and looks like a design decision.
const BANDS = [
  'bg-bg/0',
  'bg-bg/5',
  'bg-bg/10',
  'bg-bg/20',
  'bg-bg/30',
  'bg-bg/40',
  'bg-bg/50',
  'bg-bg/60',
  'bg-bg/70',
  'bg-bg/80',
];

export type ScrimProps = {
  className?: string;
};

// Sits under content laid over a photo, so the text below has something to be
// legible against whatever the photograph happens to be.
export function Scrim({ className }: ScrimProps) {
  return (
    <View
      pointerEvents="none"
      aria-hidden
      className={cn('absolute inset-x-0 bottom-0 h-40', className)}
    >
      {BANDS.map((band) => (
        <View key={band} className={cn('flex-1', band)} />
      ))}

      <View className="h-8 bg-bg/90" />
    </View>
  );
}
