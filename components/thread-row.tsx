import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Text } from '@/components/ui';
import { formatRelativeTime } from '@/lib/format';
import type { Thread } from '@/hooks/use-threads';

export type ThreadRowProps = {
  thread: Thread;
  isMine: boolean;
  onPress: () => void;
};

export function ThreadRow({ thread, isMine, onPress }: ThreadRowProps) {
  const { t } = useTranslation();

  const name = thread.other_deleted ? t('chat.deleted_account') : thread.other_name;
  const unread = thread.unread_count > 0;

  const preview = () => {
    if (thread.unmatched) {
      return t('chat.unmatched');
    }

    if (!thread.last_body && !thread.last_deleted) {
      return t('chat.say_hello');
    }

    if (thread.last_deleted) {
      return t('chat.deleted');
    }

    return isMine ? t('chat.preview_from_you', { body: thread.last_body }) : thread.last_body;
  };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('chat.open_thread', { name })}
      className="flex-row items-center gap-4 rounded-card px-2 py-3 active:bg-surface"
    >
      <Avatar
        name={name}
        identity={thread.other_id}
        photoKey={thread.other_photo_key}
        size="md"
      />

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-baseline justify-between gap-2">
          <Text variant="label" className="shrink font-strong" numberOfLines={1}>
            {name}
          </Text>

          {thread.last_at ? (
            <Text variant="caption" tone="subtle">
              {formatRelativeTime(new Date(thread.last_at))}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center justify-between gap-2">
          <Text
            variant="caption"
            tone={unread ? 'default' : 'muted'}
            className="shrink"
            numberOfLines={1}
          >
            {preview()}
          </Text>

          {unread ? (
            <View className="min-w-5 items-center rounded-full bg-brand px-1.5 py-0.5">
              <Text variant="overline" tone="inverted">
                {thread.unread_count}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}
