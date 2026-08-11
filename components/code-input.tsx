import { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';

export type CodeInputProps = {
  label: string;
  value: string;
  length: number;
  onChange: (value: string) => void;
  autoFocus?: boolean;
};

// One real input behind a row of boxes. One input per digit has to hand focus
// back and forth on every keystroke and on backspace, and a pasted code lands
// entirely in the first box.
export function CodeInput({
  label,
  value,
  length,
  onChange,
  autoFocus = false,
}: CodeInputProps) {
  const input = useRef<TextInput>(null);
  const digits = Array.from({ length }, (_, index) => value[index] ?? '');

  return (
    <Pressable
      accessibilityRole="none"
      onPress={() => input.current?.focus()}
      className="relative"
    >
      {/* Hidden from assistive technology: the input below is already
          announced, and these would read as six more empty fields. */}
      <View aria-hidden className="flex-row justify-between gap-2">
        {digits.map((digit, index) => (
          <View
            key={index}
            className={cn(
              'h-16 flex-1 items-center justify-center rounded-control border bg-surface-raised',
              index === Math.min(value.length, length - 1)
                ? 'border-brand'
                : 'border-border',
            )}
          >
            <Text variant="title">{digit}</Text>
          </View>
        ))}
      </View>

      <TextInput
        ref={input}
        accessibilityLabel={label}
        value={value}
        onChangeText={(next) => onChange(next.replace(/\D/g, '').slice(0, length))}
        maxLength={length}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        // Lets the platform offer the code from the notification instead of
        // making the user switch to their mail app and memorise it.
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        // Invisible but still focused and editable. Not hidden: a display-none
        // input cannot receive a keystroke or a paste.
        className="absolute inset-0 opacity-0"
      />
    </Pressable>
  );
}
