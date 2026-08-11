import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { PhotoGrid, PhotoGridSkeleton } from '@/components/photo-grid';
import { useUploadPhoto } from '@/hooks/use-photo-upload';
import {
  MAX_PHOTOS,
  useDeletePhoto,
  useMyPhotos,
  useReorderPhotos,
  type Photo,
} from '@/hooks/use-photos';

type Notice = { text: string; tone: 'muted' | 'danger' };

export default function PhotosScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: photos, isPending, isError, isFetching, refetch } = useMyPhotos();
  const upload = useUploadPhoto();
  const remove = useDeletePhoto();
  const reorder = useReorderPhotos();

  const [notice, setNotice] = useState<Notice | null>(null);

  const ordered = photos ?? [];
  const busy = upload.isPending || remove.isPending || reorder.isPending;

  const fail = (text: string) => {
    setNotice({ text, tone: 'danger' });
  };

  const uploadFailure = (error: unknown): Notice => {
    const code = error instanceof Error ? error.message : 'internal_error';

    if (code === 'photo_limit_reached') {
      return { text: t('photos.limit_reached', { count: MAX_PHOTOS }), tone: 'danger' };
    }

    // Not upload_failed: nothing is wrong with the photo, and retrying a slot
    // that filled while this screen was open cannot work.
    if (code === 'position_taken') {
      return { text: t('photos.position_taken'), tone: 'danger' };
    }

    return { text: t('photos.upload_failed'), tone: 'danger' };
  };

  const add = (position: number) => {
    setNotice(null);

    upload.mutate(position, {
      onSuccess: (outcome) => {
        if (outcome.status === 'awaiting_review') {
          setNotice({ text: t('photos.awaiting_review'), tone: 'muted' });
        }
      },
      onError: (error) => {
        setNotice(uploadFailure(error));
      },
    });
  };

  const move = (photo: Photo, direction: -1 | 1) => {
    const ids = ordered.map((entry) => entry.id);
    const from = ids.indexOf(photo.id);
    const to = from + direction;

    if (from === -1 || to < 0 || to >= ids.length) {
      return;
    }

    const next = [...ids];
    next[from] = ids[to];
    next[to] = ids[from];

    setNotice(null);
    reorder.mutate(next, { onError: () => fail(t('photos.reorder_failed')) });
  };

  // Before the grid, not after it. A read that failed used to render six empty
  // slots, which invites an upload into a slot that may already hold a photo.
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

  return (
    <Screen
      scroll
      className="gap-8 py-8"
      refreshing={isFetching && !isPending}
      onRefresh={() => {
        void refetch();
      }}
    >
      <View className="gap-3">
        <Text variant="title">{t('profile.photos')}</Text>
        <Text tone="muted">{t('photos.subtitle')}</Text>
      </View>

      {isPending ? (
        <PhotoGridSkeleton />
      ) : (
        <PhotoGrid
          photos={ordered}
          busy={busy}
          onAdd={add}
          onDelete={(photo) => {
            setNotice(null);
            remove.mutate(photo.id, { onError: () => fail(t('photos.delete_failed')) });
          }}
          onMove={move}
        />
      )}

      {notice ? (
        <Text variant="caption" tone={notice.tone} role="alert">
          {notice.text}
        </Text>
      ) : null}

      {/* Not a placeholder for a missing feature: no photo can be approved until
          a moderation provider exists, so saying so beats leaving every slot
          stuck on "being reviewed" with no explanation. */}
      <Card elevation="flat" className="gap-2">
        <Text variant="label" tone="muted">
          {t('photos.review_title')}
        </Text>
        <Text variant="caption" tone="subtle">
          {t('photos.review_body')}
        </Text>
      </Card>

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
