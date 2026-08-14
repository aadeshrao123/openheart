import { useState } from 'react';
import { View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Skeleton, Text } from '@/components/ui';
import { MatchCelebration } from '@/components/match-celebration';
import { ProfileScroll, type LikeTarget } from '@/components/profile-scroll';
import { SafetyActions } from '@/components/safety-actions';
import { RATE_LIMITED, useDiscovery, useSwipe } from '@/hooks/use-discovery';

function CandidateSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="gap-6"
    >
      <View className="gap-2">
        <Skeleton shape="title" className="w-1/2" />
        <Skeleton shape="caption" className="w-1/3" />
      </View>

      <Skeleton shape="card" />
      <Skeleton shape="block" />
    </View>
  );
}

// Reads the candidate out of the deck's cache rather than fetching it. There is
// no "get one profile by id" route that would be safe to add: profiles_select_
// others would allow it, but a per-id lookup is exactly the shape of an
// enumeration endpoint, and discover_profiles already applied every filter this
// user is entitled to.
export default function CandidateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: deck, isPending } = useDiscovery();
  const swipe = useSwipe();

  const [safetyOpen, setSafetyOpen] = useState(false);
  const [matched, setMatched] = useState<{ name: string; matchId: string | null } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const candidate = deck?.find((entry) => entry.id === id);

  // An empty cache and a deck that has not loaded look the same from here, so
  // the redirect below has to wait for the query.
  if (isPending) {
    return (
      <Screen scroll className="gap-6 py-6">
        <CandidateSkeleton />
      </Screen>
    );
  }

  if (!candidate) {
    return <Redirect href="/deck" />;
  }

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/deck'));

  const decide = (direction: 'like' | 'pass', target: LikeTarget = {}) =>
    swipe.mutate(
      {
        targetId: candidate.id,
        direction,
        likedPhotoId: target.likedPhotoId ?? null,
        likedPrompt: target.likedPrompt ?? null,
        comment: target.comment ?? null,
      },
      {
        onSuccess: ({ matchedName, matchId }) =>
          matchedName === null ? leave() : setMatched({ name: matchedName, matchId }),

        onError: (error) =>
          setNotice(
            error instanceof Error && error.message === RATE_LIMITED
              ? t('deck.rate_limited')
              : t('common.error_generic'),
          ),
      },
    );

  return (
    <Screen scroll className="gap-6 py-6">
      <View aria-hidden={matched !== null} className="gap-6">
        <ProfileScroll
          candidate={candidate}
          busy={swipe.isPending}
          onLike={(target) => decide('like', target)}
          onPass={() => decide('pass')}
        />

        {notice ? (
          <Text variant="caption" tone="danger" role="alert" className="text-center">
            {notice}
          </Text>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          label={t('safety.title', { name: candidate.display_name })}
          onPress={() => setSafetyOpen(true)}
        />

        <Button variant="secondary" label={t('common.back')} onPress={leave} />
      </View>

      <SafetyActions
        visible={safetyOpen}
        name={candidate.display_name}
        targetId={candidate.id}
        onClose={() => setSafetyOpen(false)}
        onBlocked={() => router.replace('/deck')}
      />

      {matched !== null ? (
        <MatchCelebration
          name={matched.name}
          matchId={matched.matchId}
          onOpenChat={(matchId) => {
            setMatched(null);
            router.replace({ pathname: '/chat/[id]', params: { id: matchId } });
          }}
          onDismiss={() => {
            setMatched(null);
            leave();
          }}
        />
      ) : null}
    </Screen>
  );
}
