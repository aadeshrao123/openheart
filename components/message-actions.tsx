import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { REACTION_CODES, reactionGlyph, type ReactionCode } from '@/lib/reactions';

export type MessageActionsProps = {
  visible: boolean;
  mine: boolean;
  canUnsend: boolean;
  selected: ReactionCode | null;
  onReact: (code: ReactionCode | null) => void;
  onUnsend: () => void;
  onClose: () => void;
};

export function MessageActions({
  visible,
  mine,
  canUnsend,
  selected,
  onReact,
  onUnsend,
  onClose,
}: MessageActionsProps) {
  const { t } = useTranslation();

  // animationType none, deliberately. react-native-web unmounts the modal on an
  // animationend event, which never fires when the tab is not compositing or
  // the reader has asked for reduced motion, and the sheet then cannot be
  // dismissed at all. Same rule as the swipe deck: nothing the user has to be
  // able to do waits on an animation callback.
  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-end p-4">
        {/* A sibling of the sheet rather than its parent. Wrapping the sheet in
            a pressable backdrop nests one accessibilityRole="button" inside
            another, which on web is a <button> inside a <button>: invalid HTML,
            and the browser stops delivering presses to either of them. */}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          className="absolute inset-0 bg-shadow/50"
        />

        <View className="w-full max-w-content gap-4 rounded-card bg-surface-raised p-4">
          <View className="flex-row justify-between">
            {REACTION_CODES.map((code) => (
              <Pressable
                key={code}
                onPress={() => onReact(selected === code ? null : code)}
                accessibilityRole="button"
                accessibilityState={{ selected: selected === code }}
                aria-pressed={selected === code}
                accessibilityLabel={t(`chat.reaction_${code}`)}
                className={cn(
                  'h-12 w-12 items-center justify-center rounded-full',
                  selected === code ? 'bg-brand-subtle' : 'bg-transparent',
                )}
              >
                <Text variant="title">{reactionGlyph(code)}</Text>
              </Pressable>
            ))}
          </View>

          {mine ? (
            <Button
              variant="danger"
              size="sm"
              label={t('chat.unsend')}
              disabled={!canUnsend}
              onPress={onUnsend}
            />
          ) : null}

          {mine && !canUnsend ? (
            <Text variant="caption" tone="subtle" className="text-center">
              {t('chat.unsend_too_late')}
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
