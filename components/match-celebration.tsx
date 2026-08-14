import { useEffect } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';

export type MatchCelebrationProps = {
  name: string;
  // Absent only when the match id could not be read back, which means the
  // celebration still shows and simply cannot offer the conversation.
  matchId?: string | null;
  onOpenChat?: (matchId: string) => void;
  onDismiss: () => void;
};

// An overlay rather than a route: it interrupts the deck for a moment and then
// gives it back, and pushing a screen would put a back button on a celebration.
export function MatchCelebration({
  name,
  matchId = null,
  onOpenChat,
  onDismiss,
}: MatchCelebrationProps) {
  const { t } = useTranslation();

  // Once per match, because the deck keys this overlay by the person swiped on
  // and two matches in a row mount it twice. Tied to the overlay appearing
  // rather than to the swipe that caused it: the match is not known until the
  // insert comes back, and a buzz on a swipe that turned out not to match would
  // be telling the user something that is not true.
  useEffect(() => {
    haptics.matchMade();
  }, []);

  return (
    <View
      // Covers the deck, including the like and pass buttons underneath, so a
      // stray tap cannot swipe the next profile while this is up.
      style={{ position: 'absolute', inset: 0 }}
      className="items-center justify-center gap-8 bg-bg px-4"
      accessibilityViewIsModal
      aria-modal
      accessibilityRole="alert"
    >
      {/* The best moment in the app was a line of text and a button. The disc
          is the closest thing to the share card's glow that works on native
          too, since a real gradient there means a colour in JavaScript. */}
      <View className="items-center justify-center">
        <View className="absolute h-44 w-44 rounded-full bg-brand-subtle" />
        <View className="absolute h-28 w-28 rounded-full bg-brand/20" />

        <Icon
          name="heart"
          size="xl"
          filled
          className="text-brand motion-safe:animate-beat will-change-transform"
        />
      </View>

      <View className="items-center gap-3 motion-safe:animate-fade-up">
        <Text variant="display" tone="brand">
          {t('matches.celebrate_title')}
        </Text>

        <Text variant="heading" tone="muted" className="text-center">
          {t('matches.new_match', { name })}
        </Text>
      </View>

      <View className="w-full gap-3 motion-safe:animate-fade-up-1">
        {/* Chat was Phase 5 when this screen was written and the button was
            left out because it would have gone nowhere. It exists now, and the
            match id was already being read to confirm the trigger fired. */}
        {matchId !== null && onOpenChat ? (
          <Button
            label={t('matches.send_message')}
            onPress={() => onOpenChat(matchId)}
            className="w-full"
          />
        ) : null}

        <Button
          variant={matchId !== null && onOpenChat ? 'secondary' : 'primary'}
          label={t('matches.keep_swiping')}
          onPress={onDismiss}
          className="w-full"
        />
      </View>
    </View>
  );
}
