import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from '@/components/ui';
import { cn } from '@/lib/cn';

export type MessageComposerProps = {
  onSend: (body: string) => void;
  disabled?: boolean;
  error?: string;
};

export function MessageComposer({ onSend, disabled = false, error }: MessageComposerProps) {
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
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}

      <View className="flex-row items-end gap-2">
        <TextInput
          multiline
          value={draft}
          onChangeText={setDraft}
          editable={!disabled}
          placeholder={t('chat.placeholder')}
          accessibilityLabel={t('chat.placeholder')}
          maxLength={2000}
          className={cn(
            'max-h-24 flex-1 rounded-control border border-border bg-surface-raised',
            'px-4 py-3 text-body font-body text-fg',
            'placeholder:text-fg-subtle selection:bg-brand-subtle',
          )}
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
