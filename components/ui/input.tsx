import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';
import { useTypeface } from '@/lib/typeface';

export type InputProps = TextInputProps & {
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  containerClassName?: string;
};

// placeholder: and selection: are NativeWind variants that move colour onto
// placeholderTextColor and selectionColor, which are otherwise JavaScript props
// and would need a literal.
export function Input({
  label,
  error,
  hint,
  className,
  containerClassName,
  ...props
}: InputProps) {
  const message = error ?? hint;

  // A TextInput is not a Text and inherits nothing from one, so the family it
  // draws typed characters and its placeholder in has to be asked for here.
  const typeface = useTypeface();

  return (
    <View className={cn('gap-2', containerClassName)}>
      <Text variant="overline" tone="subtle">
        {label}
      </Text>

      <TextInput
        accessibilityLabel={label}
        className={cn(
          'h-13 rounded-control border bg-surface-raised px-4',
          'text-body text-fg',
          typeface.body,
          'placeholder:text-fg-subtle selection:bg-brand-subtle',
          error ? 'border-danger' : 'border-border',
          className,
        )}
        {...props}
      />

      {message ? (
        <Text variant="caption" tone={error ? 'danger' : 'subtle'}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}
