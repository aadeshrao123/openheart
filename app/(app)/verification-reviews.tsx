import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Skeleton, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { VerificationReviewCard } from '@/components/verification-review-card';
import { useIsModerator } from '@/hooks/use-moderation';
import { useVerificationReviews } from '@/hooks/use-verification-reviews';

function ReviewQueueSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="gap-6"
    >
      {[0, 1, 2].map((card) => (
        <Card key={card} className="gap-4">
          <View className="gap-2">
            <Skeleton shape="caption" className="w-1/3" />
            <Skeleton shape="heading" className="w-1/2" />
            <Skeleton shape="caption" className="w-2/5" />
          </View>

          <Skeleton shape="line" className="h-10" />
        </Card>
      ))}
    </View>
  );
}

// Only failures arrive here. Face comparison is measurably less accurate on
// darker skin, so a machine saying no is a reason for a person to look.
export default function VerificationReviewsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isModerator = useIsModerator();
  const { data: reviews, isPending, isError, isFetching, refetch } = useVerificationReviews();

  // Ahead of every query state: the query is disabled for a non-moderator, so
  // isPending never clears for them and a skeleton would spin forever.
  if (!isModerator) {
    return (
      <Screen className="justify-center gap-5">
        <Text variant="title">{t('review.title')}</Text>
        <Text tone="muted">{t('moderation.not_a_moderator')}</Text>
        <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  if (isError) {
    return (
      <LoadFailed
        retrying={isFetching}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  const rows = reviews ?? [];
  const isEmpty = !isPending && rows.length === 0;

  return (
    <Screen
      scroll
      className="gap-6 py-6"
      refreshing={isFetching && !isPending}
      onRefresh={() => {
        void refetch();
      }}
    >
      <View className="gap-2">
        <View className="h-px w-12 bg-brand" />
        <Text variant="title">{t('review.title')}</Text>
      </View>

      <Text variant="caption" tone="muted">
        {t('review.intro')}
      </Text>

      {isPending ? <ReviewQueueSkeleton /> : null}

      {isEmpty ? (
        <Card elevation="flat">
          <Text tone="muted">{t('review.empty')}</Text>
        </Card>
      ) : null}

      {rows.map((review) => (
        <VerificationReviewCard key={review.id} review={review} />
      ))}

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
