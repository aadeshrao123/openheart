import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

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

  return (
    <View className={cn('gap-2', containerClassName)}>
      <Text variant="label" tone="muted">
        {label}
      </Text>

      <TextInput
        accessibilityLabel={label}
        className={cn(
          'h-12 rounded-control border bg-surface-raised px-4 text-body text-fg',
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
