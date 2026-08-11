import { Text as NativeText, type TextProps } from 'react-native';
import { cn } from '@/lib/cn';

type Variant = keyof typeof variants;
type Tone = keyof typeof tones;

const variants = {
  display: 'text-display font-display',
  title: 'text-title font-display',
  heading: 'text-heading font-strong',
  body: 'text-body font-body',
  label: 'text-label font-emphasis',
  caption: 'text-caption font-body',
  overline: 'text-overline font-strong uppercase',
  quote: 'text-heading font-quote',
  monogram: 'text-monogram font-display',
} as const;

const tones = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  subtle: 'text-fg-subtle',
  inverted: 'text-fg-inverted',
  brand: 'text-brand',
  accent: 'text-accent',
  danger: 'text-danger',
} as const;

export type TextComponentProps = TextProps & {
  variant?: Variant;
  tone?: Tone;
  className?: string;
};

export function Text({
  variant = 'body',
  tone = 'default',
  className,
  ...props
}: TextComponentProps) {
  return (
    <NativeText
      className={cn(variants[variant], tones[tone], className)}
      {...props}
    />
  );
}
