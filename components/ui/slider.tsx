import { useMemo, useState } from 'react';
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
export function Slider({ value, min, max, step = 1, onChange, label, className }: SliderProps) {
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  // Rebuilt when the geometry or the handler changes. A responder held in a ref
  // would close over the first width it ever saw, which is zero.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => onChange(at(event.nativeEvent.locationX)),
        onPanResponderMove: (event) => onChange(at(event.nativeEvent.locationX)),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [width, min, max, step, onChange],
  );

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
      <View className="h-1.5 w-full rounded-full bg-surface-raised" />

      <View
        className="absolute h-1.5 rounded-full bg-brand"
        style={{ width: Math.max(THUMB / 2, offset + THUMB / 2) }}
      />

      <View
        className={cn(
          'absolute h-7 w-7 rounded-full border-2 border-brand bg-bg',
          'shadow-sm shadow-shadow/20',
        )}
        style={{ transform: [{ translateX: offset }] }}
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

// Two thumbs on one track. Each is its own adjustable control for a screen
// reader, because "age range" as a single element cannot be operated.
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
  return (
    <View className={cn('gap-1', className)}>
      <Slider
        value={low}
        min={min}
        max={max}
        step={step}
        label={lowLabel}
        onChange={(next) => onChange(Math.min(next, high), high)}
      />

      <Slider
        value={high}
        min={min}
        max={max}
        step={step}
        label={highLabel}
        onChange={(next) => onChange(low, Math.max(next, low))}
      />
    </View>
  );
}
