import { View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { useLikesReceived } from '@/hooks/use-discovery';
import { formatRelativeTime } from '@/lib/format';
import { photoUrl } from '@/lib/photos';

// Never behind a payment. Charging to see who liked you is the single most
// common paid feature in this category and the clearest example of the thing
// this project refuses.
export default function LikesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data, isPending, isError, isFetching, refetch } = useLikesReceived();

  if (isPending) {
    return (
      <Screen scroll className="gap-4 py-6">
        <View accessibilityRole="progressbar" aria-busy className="gap-4">
          <Skeleton shape="title" className="w-1/2" />
          <Skeleton shape="block" />
          <Skeleton shape="block" />
        </View>
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

  const likes = data ?? [];

  return (
    <Screen scroll className="gap-6 py-6" refreshing={isFetching} onRefresh={() => void refetch()}>
      {likes.length === 0 ? (
        <EmptyState icon="heart" title={t('likes.title')} body={t('likes.empty')} />
      ) : (
        <View className="gap-2">
          <Text variant="title">{t('likes.title')}</Text>

          <Text tone="muted">{t('likes.body', { count: likes.length })}</Text>
        </View>
      )}

      {likes.map((like) => (
        <Card key={like.swiper_id} className="gap-4">
          <View className="flex-row items-center gap-3">
            <Avatar
              name={like.display_name}
              identity={like.swiper_id}
              photoKey={like.photo_key}
              size="md"
            />

            <View className="flex-1 gap-0.5">
              <Text variant="heading">
                {t('deck.name_age', { name: like.display_name, age: like.age })}
              </Text>

              <Text variant="caption" tone="subtle">
                {formatRelativeTime(new Date(like.created_at))}
              </Text>
            </View>
          </View>

          {/* What they picked, which is the whole point of the mechanic. A bare
              "somebody liked you" is worth far less than "they liked this". */}
          {like.liked_prompt ? (
            <Text variant="caption" tone="accent">
              {t('likes.liked_prompt', { prompt: t(`profile.prompt_${like.liked_prompt}`) })}
            </Text>
          ) : null}

          {like.liked_photo_id ? (
            <View className="h-40 overflow-hidden rounded-card bg-surface">
              <Image
                source={{ uri: photoUrl(like.liked_photo_id, 'medium') }}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={150}
                accessibilityLabel={t('likes.liked_photo')}
              />
            </View>
          ) : null}

          {like.comment ? (
            <Card elevation="flat">
              <Text variant="quote">{like.comment}</Text>
            </Card>
          ) : null}

          <Button
            label={t('likes.open_profile')}
            onPress={() =>
              router.push({ pathname: '/candidate/[id]', params: { id: like.swiper_id } })
            }
          />
        </Card>
      ))}

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
