import { Text as NativeText, type TextProps } from 'react-native';
import { cn } from '@/lib/cn';
import { useTypeface, type FontRole } from '@/lib/typeface';

type Variant = keyof typeof variants;
type Tone = keyof typeof tones;

// The font role is held apart from the text utilities because it is resolved
// against the active language at render time and the size never is. A variant
// names a role, not a family: which family serves the role is lib/typeface.ts.
const variants = {
  display: { text: 'text-display', font: 'display' },
  title: { text: 'text-title', font: 'display' },
  heading: { text: 'text-heading', font: 'strong' },
  body: { text: 'text-body', font: 'body' },
  label: { text: 'text-label', font: 'emphasis' },
  caption: { text: 'text-caption', font: 'body' },
  overline: { text: 'text-overline uppercase', font: 'strong' },
  quote: { text: 'text-heading', font: 'quote' },
  monogram: { text: 'text-monogram', font: 'display' },
} as const satisfies Record<string, { text: string; font: FontRole }>;

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
  // Overrides the variant's role when a caller wants one size at another
  // weight. Ask for the role here rather than passing a font-* class through
  // className: a class names a family, and a family is Latin only.
  font?: FontRole;
  className?: string;
};

export function Text({
  variant = 'body',
  tone = 'default',
  font,
  className,
  ...props
}: TextComponentProps) {
  const typeface = useTypeface();

  return (
    <NativeText
      className={cn(
        variants[variant].text,
        typeface[font ?? variants[variant].font],
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
