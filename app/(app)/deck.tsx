import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { MatchCelebration } from '@/components/match-celebration';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe-deck';
import {
  REFILL_THRESHOLD,
  useDiscovery,
  useSwipe,
  type Candidate,
  type SwipeDirection,
} from '@/hooks/use-discovery';

export default function DeckScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, isPending, isError, refetch } = useDiscovery();
  const swipe = useSwipe();

  const deckRef = useRef<SwipeDeckHandle>(null);
  const [matchedName, setMatchedName] = useState<string | null>(null);

  const deck = data ?? [];

  const handleSwipe = (candidate: Candidate, direction: SwipeDirection) => {
    swipe.mutate(
      { targetId: candidate.id, direction },
      {
        onSuccess: (result) => {
          if (result.matchedName !== null) {
            setMatchedName(result.matchedName);
          }
        },

        // Refilled here rather than from an effect watching the deck length.
        // The optimistic removal shortens the deck before the insert lands, so
        // a refetch driven by length would ask the server for more while it
        // still considers the card unswiped, and it would come straight back.
        onSettled: () => {
          if (deck.length - 1 <= REFILL_THRESHOLD) {
            void refetch();
          }
        },
      },
    );
  };

  if (isPending) {
    return (
      <Screen className="items-center justify-center">
        <Text tone="muted">{t('common.loading')}</Text>
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen className="justify-center gap-6">
        <Text variant="title">{t('common.error_generic')}</Text>
        <Button label={t('common.retry')} onPress={() => void refetch()} />
      </Screen>
    );
  }

  if (deck.length === 0) {
    return (
      <Screen className="justify-center gap-6">
        <View className="gap-2">
          <Text variant="title">{t('deck.empty_title')}</Text>
          <Text tone="muted">{t('deck.empty_body')}</Text>
        </View>

        <Button
          label={t('deck.widen_search')}
          onPress={() => router.push('/edit-profile')}
        />
        <Button variant="ghost" label={t('common.retry')} onPress={() => void refetch()} />
      </Screen>
    );
  }

  const celebrating = matchedName !== null;

  return (
    <Screen className="gap-4 py-4">
      {/* aria-hidden as well as the overlay's own accessibilityViewIsModal,
          which is iOS only. Without it a screen reader on web reads straight
          past the celebration into the next profile. */}
      <View className="flex-1 gap-4" aria-hidden={celebrating}>
        <SwipeDeck ref={deckRef} candidates={deck} onSwipe={handleSwipe} />

        {/* The only route through this screen that works with a screen reader,
            so they carry real labels rather than being decoration under the
            deck. */}
        <View className="flex-row justify-center gap-4">
          <Button
            variant="secondary"
            label={t('deck.pass')}
            className="flex-1"
            disabled={swipe.isPending || celebrating}
            onPress={() => deckRef.current?.swipe('pass')}
          />
          <Button
            label={t('deck.like')}
            className="flex-1"
            disabled={swipe.isPending || celebrating}
            onPress={() => deckRef.current?.swipe('like')}
          />
        </View>
      </View>

      {matchedName ? (
        <MatchCelebration
          name={matchedName}
          onDismiss={() => setMatchedName(null)}
        />
      ) : null}
    </Screen>
  );
}
