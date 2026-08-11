import { useRef, useState } from 'react';
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

  // The only focusable element here is the input below, and it is opacity-0, so
  // the browser draws its focus ring where nothing is visible. Every other
  // control in the app keeps the default ring; this one has to redraw it on the
  // boxes, which are the thing the user is actually looking at.
  const [focused, setFocused] = useState(false);
  const cursor = Math.min(value.length, length - 1);

  return (
    <Pressable
      accessibilityRole="none"
      onPress={() => input.current?.focus()}
      className="relative"
    >
      {/* Hidden from assistive technology: the input below is already
          announced, and these would read as six more empty fields.

          Pinned to ltr, and it is the one thing here no token can express.
          flex-row mirrors under RTL, which would put the first digit box on the
          right and fill the code backwards, but digits are laid out left to
          right in Arabic and Urdu as much as anywhere else: a code typed 123456
          would have read 654321. */}
      <View
        aria-hidden
        style={{ direction: 'ltr' }}
        className="flex-row justify-between gap-2"
      >
        {digits.map((digit, index) => (
          <View
            key={index}
            className={cn(
              'h-16 flex-1 items-center justify-center rounded-control border bg-surface-raised',
              index === cursor && focused && 'border-brand bg-brand-subtle',
              index === cursor && !focused && 'border-brand',
              index !== cursor && 'border-border',
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
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
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
