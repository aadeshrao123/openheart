import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { MessageStatus, messageState } from '@/components/message-status';
import { cn } from '@/lib/cn';
import { formatTime } from '@/lib/format';
import { reactionGlyph } from '@/lib/reactions';
import type { ChatMessage } from '@/hooks/use-chat';

export type MessageBubbleProps = {
  message: ChatMessage;
  mine: boolean;
  onOpenActions: () => void;
};

export function MessageBubble({ message, mine, onOpenActions }: MessageBubbleProps) {
  const { t } = useTranslation();

  const deleted = message.deleted_at !== null;
  const sentAt = formatTime(new Date(message.created_at));

  // Grouped, because both people can pick the same one and two identical
  // glyphs side by side reads as a rendering fault rather than agreement.
  const tally = new Map<string, number>();

  for (const reaction of message.message_reactions) {
    const glyph = reactionGlyph(reaction.reaction);

    if (glyph !== undefined) {
      tally.set(glyph, (tally.get(glyph) ?? 0) + 1);
    }
  }

  const reactions = [...tally.entries()];

  return (
    <View className={cn('w-full', mine ? 'items-end' : 'items-start')}>
      {/* Both, and deliberately. Long press is the gesture people expect on a
          phone, and a message has no competing tap action, so binding press as
          well is what makes reactions reachable with a mouse at all. */}
      <Pressable
        onPress={onOpenActions}
        onLongPress={onOpenActions}
        accessibilityRole="button"
        accessibilityLabel={
          deleted
            ? t('chat.deleted')
            : t('chat.message_by', {
                name: mine ? t('chat.you') : t('chat.them'),
                body: message.body,
              })
        }
        accessibilityHint={t('chat.long_press_hint')}
        className={cn(
          'max-w-bubble rounded-bubble px-4 py-2.5',
          deleted && 'border border-border bg-transparent',
          !deleted && mine && 'rounded-ee-tail bg-brand',
          !deleted && !mine && 'rounded-es-tail border border-border bg-surface-raised',
        )}
      >
        <Text variant="body" tone={deleted ? 'subtle' : mine ? 'inverted' : 'default'}>
          {deleted ? t('chat.deleted') : message.body}
        </Text>

        <View className="flex-row items-center gap-1.5 self-end pt-1">
          <Text
            variant="caption"
            tone={deleted || !mine ? 'subtle' : 'inverted'}
            className={mine && !deleted ? 'opacity-70' : undefined}
          >
            {sentAt}
          </Text>

          {mine && !deleted ? <MessageStatus state={messageState(message)} /> : null}
        </View>
      </Pressable>

      {reactions.length > 0 ? (
        <View
          className={cn(
            '-mt-2 flex-row gap-2 rounded-full border border-border bg-surface-raised px-2 py-0.5',
            mine ? 'me-3' : 'ms-3',
          )}
        >
          {reactions.map(([glyph, count]) => (
            <View key={glyph} className="flex-row items-center gap-1">
              <Text variant="caption">{glyph}</Text>

              {count > 1 ? (
                <Text variant="caption" tone="muted">
                  {count}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
