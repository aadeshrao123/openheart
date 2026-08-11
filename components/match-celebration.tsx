import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Text } from '@/components/ui';

export type MatchCelebrationProps = {
  name: string;
  onDismiss: () => void;
};

// An overlay rather than a route: it interrupts the deck for a moment and then
// gives it back, and pushing a screen would put a back button on a celebration.
//
// There is no "send a message" action yet. Chat is Phase 5, and a button that
// goes nowhere is worse than one that is absent.
export function MatchCelebration({ name, onDismiss }: MatchCelebrationProps) {
  const { t } = useTranslation();

  return (
    <View
      // Covers the deck, including the like and pass buttons underneath, so a
      // stray tap cannot swipe the next profile while this is up.
      style={{ position: 'absolute', inset: 0 }}
      className="items-center justify-center gap-8 bg-bg px-4"
      accessibilityViewIsModal
      accessibilityRole="alert"
    >
      <View className="items-center gap-3">
        <Text variant="display" tone="brand">
          {t('matches.celebrate_title')}
        </Text>

        <Text variant="heading" tone="muted" className="text-center">
          {t('matches.new_match', { name })}
        </Text>
      </View>

      <Button label={t('matches.keep_swiping')} onPress={onDismiss} className="w-full" />
    </View>
  );
}
