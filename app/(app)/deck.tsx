import { useRef, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Skeleton, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { MatchCelebration } from '@/components/match-celebration';
import { SwipeDeck, type SwipeDeckHandle } from '@/components/swipe-deck';
import {
  discoveryKey,
  RATE_LIMITED,
  REFILL_THRESHOLD,
  UNDO_MATCHED,
  UNDO_TOO_LATE,
  useDiscovery,
  useSwipe,
  useLikesReceived,
  useUndoSwipe,
  type Candidate,
  type SwipeDirection,
} from '@/hooks/use-discovery';

// A swipe that matched, waiting its turn. The id is the person swiped on, which
// is unique per swipe, so the overlay remounts between two matches instead of
// swapping a name inside a live region a screen reader has already read.
type Celebration = {
  id: string;
  name: string;
};

// The card, the name, distance and bio lines inside it, and the two buttons:
// the same blocks in the same places as the loaded deck.
function DeckSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="flex-1 gap-4"
    >
      <View className="flex-row justify-end">
        <Skeleton shape="block" className="h-11 w-24 rounded-control" />
      </View>

      {/* The card is one photograph now, so the skeleton is one block with the
          name and distance where they land on it rather than in a panel. */}
      <View className="flex-1 overflow-hidden rounded-card border border-border bg-surface-raised">
        <Skeleton shape="block" className="h-auto flex-1 rounded-none" />

        <View className="absolute inset-x-0 bottom-0 gap-2.5 p-5">
          <Skeleton shape="title" className="w-1/2" />
          <Skeleton shape="caption" className="w-1/3" />
        </View>
      </View>

      <View className="flex-row gap-4">
        <Skeleton shape="block" className="h-13 flex-1 rounded-control" />
        <Skeleton shape="block" className="h-13 flex-1 rounded-control" />
      </View>
    </View>
  );
}

type EmptyDeckProps = {
  onAdjust: () => void;
  onRetry: () => void;
};

// Inside the deck rather than returned early from it, because the swipe that
// emptied the deck can be the one that matched, and the celebration is an
// overlay on whatever is underneath.
function EmptyDeck({ onAdjust, onRetry }: EmptyDeckProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-1 justify-center gap-6">
      <View className="gap-2">
        <Text variant="title">{t('deck.empty_title')}</Text>
        <Text tone="muted">{t('deck.empty_body')}</Text>
      </View>

      <Button label={t('deck.widen_search')} onPress={onAdjust} />
      <Button variant="ghost" label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}

export default function DeckScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data, isPending, isError, isFetching, refetch } = useDiscovery();
  const swipe = useSwipe();
  const undo = useUndoSwipe();
  const { data: incoming } = useLikesReceived();

  const deckRef = useRef<SwipeDeckHandle>(null);
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const deck = data ?? [];
  const likes = incoming ?? [];
  const celebration: Celebration | null = celebrations[0] ?? null;

  // The two refusals from 0023 are the interesting outcomes, and both are
  // things the user did rather than errors, so each says what happened.
  const undoLast = () => {
    undo.mutate(undefined, {
      onSuccess: (undone) => setNotice(undone === null ? t('deck.undo_nothing') : null),
      onError: (error) => {
        const code =
          typeof error === 'object' && error !== null && 'code' in error
            ? String((error as { code: unknown }).code)
            : '';

        if (code === UNDO_TOO_LATE) {
          setNotice(t('deck.undo_too_late'));
          return;
        }

        setNotice(code === UNDO_MATCHED ? t('deck.undo_matched') : t('common.error_generic'));
      },
    });
  };

  const handleSwipe = (candidate: Candidate, direction: SwipeDirection) => {
    swipe.mutate(
      { targetId: candidate.id, direction },
      {
        onSuccess: ({ matchedName }) => {
          setNotice(null);

          if (matchedName !== null) {
            // Queued, not assigned. Dragging does not wait for the previous
            // swipe the way the buttons do, so two replies can arrive one
            // after the other, and the second used to overwrite the first:
            // a match nobody was ever told about.
            setCelebrations((queue) => [...queue, { id: candidate.id, name: matchedName }]);
          }
        },

        onError: (error) => {
          setNotice(
            error instanceof Error && error.message === RATE_LIMITED
              ? t('deck.rate_limited')
              : t('common.error_generic'),
          );
        },

        // Refilled here rather than from an effect watching the deck length.
        // The optimistic removal shortens the deck before the insert lands, so
        // a refetch driven by length would ask the server for more while it
        // still considers the card unswiped, and it would come straight back.
        //
        // The length is read from the cache, not from `deck`, which is the deck
        // as of the render that created this handler: two swipes started from
        // one render subtracted one from the same stale number, so neither saw
        // the threshold. Reading here is also after the rollback, so a swipe
        // that failed and put its card back does not count as progress.
        onSettled: () => {
          const remaining = queryClient.getQueryData<Candidate[]>(discoveryKey)?.length ?? 0;

          if (remaining <= REFILL_THRESHOLD) {
            void refetch();
          }
        },
      },
    );
  };

  if (isPending) {
    return (
      <Screen className="gap-4 py-4">
        <DeckSkeleton />
      </Screen>
    );
  }

  // Before the empty state, or a deck that could not load claims there is
  // nobody nearby. Not before a deck that still has cards in it, because a
  // refill that failed in the background is no reason to take a working deck
  // away, and not before an undismissed celebration, which exists only in this
  // component and cannot be fetched again.
  if (isError && deck.length === 0 && celebration === null) {
    return (
      <LoadFailed
        retrying={isFetching}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <Screen className="gap-4 py-4">
      {/* aria-hidden as well as the overlay's own accessibilityViewIsModal,
          which is iOS only. Without it a screen reader on web reads straight
          past the celebration into the next profile. */}
      <View className="flex-1 gap-4" aria-hidden={celebration !== null}>
        {deck.length === 0 ? (
          <EmptyDeck
            onAdjust={() => router.push('/filters')}
            onRetry={() => {
              void refetch();
            }}
          />
        ) : (
          <>
            <View className="flex-row items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                label={t('deck.undo')}
                disabled={undo.isPending}
                onPress={undoLast}
              />

              <View className="flex-row items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  label={
                    likes.length > 0
                      ? t('likes.waiting', { count: likes.length })
                      : t('likes.title')
                  }
                  onPress={() => router.push('/likes')}
                />

                <Button
                  variant="ghost"
                  size="sm"
                  label={t('deck.filters')}
                  onPress={() => router.push('/filters')}
                />
              </View>
            </View>

            <SwipeDeck
              ref={deckRef}
              candidates={deck}
              onSwipe={handleSwipe}
              onOpen={(candidate) =>
                router.push({ pathname: '/candidate/[id]', params: { id: candidate.id } })
              }
            />

            {notice ? (
              <Text variant="caption" tone="danger" className="text-center">
                {notice}
              </Text>
            ) : null}

            {/* The only route through this screen that works with a screen
                reader, so they carry real labels rather than being decoration
                under the deck. */}
            <View className="flex-row justify-center gap-4">
              <Button
                variant="secondary"
                label={t('deck.pass')}
                className="flex-1"
                disabled={swipe.isPending || celebration !== null}
                onPress={() => deckRef.current?.swipe('pass')}
              />
              <Button
                label={t('deck.like')}
                className="flex-1"
                disabled={swipe.isPending || celebration !== null}
                onPress={() => deckRef.current?.swipe('like')}
              />
            </View>
          </>
        )}
      </View>

      {celebration ? (
        <MatchCelebration
          key={celebration.id}
          name={celebration.name}
          // Dismissing shows the next queued match rather than the deck, and
          // nothing here waits on an animation to run.
          onDismiss={() => setCelebrations((queue) => queue.slice(1))}
        />
      ) : null}
    </Screen>
  );
}
