import { useState } from 'react';
import { Pressable, View, type TextInputProps } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text, TextArea } from '@/components/ui';
import { cn } from '@/lib/cn';

export type MessageComposerProps = {
  onSend: (body: string) => void;
  disabled?: boolean;
  error?: string;
};

export type ComposerShellProps = MessageComposerProps & {
  fieldProps?: (field: { draft: string; send: () => void }) => TextInputProps;
};

// Everything both platforms share. Only what the field does with a key press
// differs, and that arrives as fieldProps from message-composer.tsx on native
// and message-composer.web.tsx on web, so this markup exists once.
export function ComposerShell({
  onSend,
  disabled = false,
  error,
  fieldProps,
}: ComposerShellProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');

  const body = draft.trim();
  const canSend = body.length > 0 && !disabled;

  const send = () => {
    if (!canSend) {
      return;
    }

    onSend(body);
    setDraft('');
  };

  return (
    <View className="gap-2 border-t border-border px-4 pb-2 pt-3">
      {error ? (
        <Text variant="caption" tone="danger" role="alert">
          {error}
        </Text>
      ) : null}

      <View className="flex-row items-end gap-2">
        {/* max-h-24 is 96px, which holds about three 25px lines once the 12px
            padding is off it. Past that the field scrolls rather than clips:
            a multiline TextInput scrolls by default, and on web it is a real
            textarea, which the browser gives overflow auto. */}
        <TextArea
          value={draft}
          onChangeText={setDraft}
          editable={!disabled}
          placeholder={t('chat.placeholder')}
          accessibilityLabel={t('chat.placeholder')}
          aria-disabled={disabled}
          maxLength={2000}
          className="max-h-24 flex-1"
          {...fieldProps?.({ draft, send })}
        />

        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={t('chat.send')}
          aria-disabled={!canSend}
          className={cn(
            'h-12 w-12 items-center justify-center rounded-full',
            canSend ? 'bg-brand active:bg-brand-pressed' : 'bg-surface',
          )}
        >
          <Icon name="send" className={canSend ? 'text-fg-inverted' : 'text-fg-subtle'} />
        </Pressable>
      </View>
    </View>
  );
}
