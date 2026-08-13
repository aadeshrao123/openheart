import { useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { cn } from '@/lib/cn';

export type SliderProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  label: string;
  className?: string;
};

const THUMB = 28;

function quantise(raw: number, min: number, max: number, step: number): number {
  const snapped = Math.round((raw - min) / step) * step + min;

  return Math.min(max, Math.max(min, snapped));
}

// PanResponder rather than a slider package: every one of them takes its
// colours as JavaScript props, which would put a colour outside global.css.
//
// Every child is pointerEvents="none", including the thumbs. locationX is
// measured against whichever view the touch landed on, and on native that is
// the deepest one under the finger, so grabbing a thumb reported a position
// inside the 28px thumb rather than along the track. Web resolves it against
// the responder and was right by accident.
export function Slider({ value, min, max, step = 1, onChange, label, className }: SliderProps) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  // Built fresh every render rather than memoised or held in a ref, so the
  // handlers always see the current width. A ref would close over the first
  // width it ever saw, which is zero.
  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => onChange(at(event.nativeEvent.locationX)),
    onPanResponderMove: (event) => onChange(at(event.nativeEvent.locationX)),
  });

  function at(x: number): number {
    const usable = Math.max(1, width - THUMB);
    const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / usable));

    return quantise(min + ratio * (max - min), min, max, step);
  }

  const filled = max === min ? 0 : (value - min) / (max - min);
  const offset = filled * Math.max(0, width - THUMB);

  return (
    <View
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      aria-valuenow={value}
      aria-valuemin={min}
      aria-valuemax={max}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const direction = event.nativeEvent.actionName === 'increment' ? step : -step;

        onChange(quantise(value + direction, min, max, step));
      }}
      onLayout={onLayout}
      className={cn('h-11 justify-center', className)}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" className="h-1.5 w-full rounded-full bg-surface-raised" />

      <View
        pointerEvents="none"
        className="absolute h-1.5 rounded-full bg-brand"
        style={{ width: Math.max(THUMB / 2, offset + THUMB / 2) }}
      />

      <View
        pointerEvents="none"
        className={cn(
          'absolute h-7 w-7 rounded-full border-2 border-brand bg-bg',
          'shadow-sm shadow-shadow/20',
        )}
        style={{ start: offset }}
      />
    </View>
  );
}

export type RangeSliderProps = {
  low: number;
  high: number;
  min: number;
  max: number;
  step?: number;
  onChange: (low: number, high: number) => void;
  lowLabel: string;
  highLabel: string;
  className?: string;
};

// One track, two thumbs. Two stacked sliders were the first attempt and they
// read as two unrelated controls that happen to be near each other, which is
// not what a range is.
//
// Each thumb is still its own adjustable element for a screen reader. A range
// announced as one control cannot be operated by one.
export function RangeSlider({
  low,
  high,
  min,
  max,
  step = 1,
  onChange,
  lowLabel,
  highLabel,
  className,
}: RangeSliderProps) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<'low' | 'high' | null>(null);

  const span = Math.max(0, width - THUMB);
  const place = (value: number) => (max === min ? 0 : ((value - min) / (max - min)) * span);

  const responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,

    // Whichever thumb is nearer to the touch, decided once on grant. Picking it
    // again on every move makes the thumbs swap under the finger when they are
    // close together.
    onPanResponderGrant: (event) => {
      const x = event.nativeEvent.locationX;
      const nearer = Math.abs(x - place(low)) <= Math.abs(x - place(high)) ? 'low' : 'high';

      setDragging(nearer);
      apply(nearer, x);
    },

    onPanResponderMove: (event) => apply(dragging, event.nativeEvent.locationX),
    onPanResponderRelease: () => setDragging(null),
  });

  function apply(thumb: 'low' | 'high' | null, x: number) {
    if (thumb === null) {
      return;
    }

    const ratio = Math.min(1, Math.max(0, (x - THUMB / 2) / Math.max(1, span)));
    const value = quantise(min + ratio * (max - min), min, max, step);

    if (thumb === 'low') {
      onChange(Math.min(value, high), high);
      return;
    }

    onChange(low, Math.max(value, low));
  }

  const nudge = (thumb: 'low' | 'high', direction: number) => {
    if (thumb === 'low') {
      onChange(Math.min(quantise(low + direction, min, max, step), high), high);
      return;
    }

    onChange(low, Math.max(quantise(high + direction, min, max, step), low));
  };

  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      className={cn('h-11 justify-center', className)}
      {...responder.panHandlers}
    >
      <View pointerEvents="none" className="h-1.5 w-full rounded-full bg-surface-raised" />

      <View
        pointerEvents="none"
        className="absolute h-1.5 rounded-full bg-brand"
        style={{ start: place(low) + THUMB / 2, width: Math.max(0, place(high) - place(low)) }}
      />

      {(['low', 'high'] as const).map((thumb) => (
        <View
          key={thumb}
          pointerEvents="none"
          accessibilityRole="adjustable"
          accessibilityLabel={thumb === 'low' ? lowLabel : highLabel}
          aria-valuenow={thumb === 'low' ? low : high}
          aria-valuemin={min}
          aria-valuemax={max}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={(event) =>
            nudge(thumb, event.nativeEvent.actionName === 'increment' ? step : -step)
          }
          className={cn(
            'absolute h-7 w-7 rounded-full border-2 border-brand bg-bg',
            'shadow-sm shadow-shadow/20',
          )}
          style={{ start: place(thumb === 'low' ? low : high) }}
        />
      ))}
    </View>
  );
}
