import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/components/ui';
import type { ChatMessage } from '@/hooks/use-chat';

export type MessageState = 'pending' | 'sent' | 'delivered' | 'read';

const LABEL_KEYS: Record<MessageState, string> = {
  pending: 'chat.status_sending',
  sent: 'chat.status_sent',
  delivered: 'chat.status_delivered',
  read: 'chat.status_read',
};

export function messageState(message: ChatMessage): MessageState {
  if (message.pending) {
    return 'pending';
  }

  if (message.read_at) {
    return 'read';
  }

  return message.delivered_at ? 'delivered' : 'sent';
}

export type MessageStatusProps = {
  state: MessageState;
};

// One tick sent, two delivered, two green once it has been read. Three signals
// carry that last step: the count, the colour and the label, so none of them is
// load bearing on its own.
export function MessageStatus({ state }: MessageStatusProps) {
  const { t } = useTranslation();
  const label = t(LABEL_KEYS[state]);

  if (state === 'pending') {
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={label}
        className="h-3 w-3 rounded-full border border-fg-inverted opacity-40"
      />
    );
  }

  const seen = state === 'read';

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={label}
      className={seen ? undefined : 'opacity-50'}
    >
      <Icon
        name={state === 'sent' ? 'check' : 'check_double'}
        size="sm"
        strokeWidth={2.4}
        className={seen ? 'text-receipt-seen' : 'text-fg-inverted'}
      />
    </View>
  );
}
