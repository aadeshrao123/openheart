import { TextInput, type TextInputProps } from 'react-native';
import { cn } from '@/lib/cn';
import { useTypeface } from '@/lib/typeface';

// A multiline field, and its own primitive rather than a variant of Input.
// Input's anatomy is a visible overline label, the field, then a hint or an
// error, and its label prop is required and always rendered. Every multiline
// field in this app is the opposite shape: no visible label, a placeholder, and
// a height the caller sets. Adding a multiline flag to Input would have meant
// making its label row conditional, which is exactly the guarantee Input is
// there to enforce.
//
// accessibilityLabel is required here for the same reason. A placeholder is not
// an accessible name: it is announced by some screen readers and not others,
// and it disappears the moment the field has content.
//
// Nothing user-visible is written in this file. The placeholder and the label
// are the caller's translated strings, so adding this primitive adds no
// translation key to any bundle.
export type TextAreaProps = TextInputProps & {
  accessibilityLabel: string;
  className?: string;
};

export function TextArea({ accessibilityLabel, className, ...props }: TextAreaProps) {
  // A TextInput is not a Text and inherits nothing from one, so the family it
  // draws typed characters and its placeholder in has to be asked for here.
  const typeface = useTypeface();

  return (
    <TextInput
      multiline
      accessibilityLabel={accessibilityLabel}
      className={cn(
        'rounded-control border border-border bg-surface-raised px-4 py-3',
        'text-body text-fg',
        typeface.body,
        'placeholder:text-fg-subtle selection:bg-brand-subtle',
        className,
      )}
      {...props}
    />
  );
}
