import { Text as NativeText, type TextProps } from 'react-native';
import { cn } from '@/lib/cn';

type Variant = keyof typeof variants;
type Tone = keyof typeof tones;

const variants = {
  display: 'text-display',
  title: 'text-title',
  heading: 'text-heading',
  body: 'text-body',
  label: 'text-label',
  caption: 'text-caption',
} as const;

const tones = {
  default: 'text-fg',
  muted: 'text-fg-muted',
  subtle: 'text-fg-subtle',
  inverted: 'text-fg-inverted',
  brand: 'text-brand',
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
