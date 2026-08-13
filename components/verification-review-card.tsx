import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Button, Card, Rail, Skeleton, Text } from '@/components/ui';
import { formatDate, formatTime } from '@/lib/format';
import {
  useReviewSelfie,
  useReviewVerification,
  type VerificationReview,
} from '@/hooks/use-verification-reviews';

export type VerificationReviewCardProps = {
  review: VerificationReview;
};

// Nothing is fetched until the moderator asks: every signed URL is a live
// handle on a private object.
export function VerificationReviewCard({ review }: VerificationReviewCardProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const photos = useReviewSelfie(review.id, opened);
  const decide = useReviewVerification();

  const takenAt = new Date(review.created_at);

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text variant="overline" tone="brand">
          {t(`verify.pose_${review.challenge}`)}
        </Text>

        <Text variant="heading">{review.display_name}</Text>

        <Text variant="caption" tone="subtle">
          {t('moderation.filed_at', {
            date: formatDate(takenAt),
            time: formatTime(takenAt),
          })}
        </Text>
      </View>

      {review.failure_reason ? (
        <Rail tone="accent" className="ps-4">
          <Text variant="caption">
            {t(`verify.reason_${review.failure_reason}`, {
              defaultValue: review.failure_reason,
            })}
          </Text>
        </Rail>
      ) : null}

      <Text variant="caption" tone={review.attempt_count > 2 ? 'danger' : 'muted'}>
        {t('review.attempt_count', { count: review.attempt_count })}
      </Text>

      {opened ? (
        <View className="gap-3">
          {photos.isPending ? (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={t('common.loading')}
              aria-busy
              className="gap-3"
            >
              <Skeleton shape="line" className="aspect-card h-auto w-full" />
            </View>
          ) : null}

          {photos.isError ? (
            <Text variant="caption" tone="danger">
              {t('review.load_failed')}
            </Text>
          ) : null}

          {photos.data ? (
            <>
              <View className="gap-1">
                <Text variant="overline" tone="subtle">
                  {t('review.selfie')}
                </Text>

                <View className="aspect-card overflow-hidden rounded-card bg-surface">
                  <Image
                    source={{ uri: photos.data.selfie_url }}
                    style={{ width: '100%', height: '100%' }}
                    contentFit="contain"
                    accessibilityLabel={t('review.selfie')}
                  />
                </View>
              </View>

              <View className="gap-1">
                <Text variant="overline" tone="subtle">
                  {t('review.profile_photos')}
                </Text>

                <View className="flex-row flex-wrap gap-2">
                  {photos.data.photo_urls.map((url, index) => (
                    <View
                      key={url}
                      className="aspect-card w-24 overflow-hidden rounded-card bg-surface"
                    >
                      <Image
                        source={{ uri: url }}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        accessibilityLabel={t('photos.slot', { position: index + 1 })}
                      />
                    </View>
                  ))}
                </View>
              </View>

              <Text variant="caption" tone="subtle">
                {t('review.question')}
              </Text>

              <View className="gap-2">
                <Button
                  variant="primary"
                  size="sm"
                  label={t('review.action_approve')}
                  loading={decide.isPending}
                  onPress={() => decide.mutate({ attemptId: review.id, approved: true })}
                />

                <Button
                  variant="danger"
                  size="sm"
                  label={t('review.action_reject')}
                  loading={decide.isPending}
                  onPress={() => decide.mutate({ attemptId: review.id, approved: false })}
                />
              </View>
            </>
          ) : null}
        </View>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          label={t('review.open')}
          onPress={() => setOpened(true)}
        />
      )}

      {decide.isError ? (
        <Text variant="caption" tone="danger">
          {t('common.error_generic')}
        </Text>
      ) : null}
    </Card>
  );
}
