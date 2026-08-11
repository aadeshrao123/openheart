import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text } from '@/components/ui';
import { PhotoGrid } from '@/components/photo-grid';
import { useUploadPhoto } from '@/hooks/use-photo-upload';
import {
  MAX_PHOTOS,
  useDeletePhoto,
  useMyPhotos,
  useReorderPhotos,
  type Photo,
} from '@/hooks/use-photos';

export default function PhotosScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: photos } = useMyPhotos();
  const upload = useUploadPhoto();
  const remove = useDeletePhoto();
  const reorder = useReorderPhotos();

  const [notice, setNotice] = useState<string | null>(null);

  const ordered = photos ?? [];
  const busy = upload.isPending || remove.isPending || reorder.isPending;

  const add = (position: number) => {
    setNotice(null);

    upload.mutate(position, {
      onSuccess: (outcome) => {
        if (outcome.status === 'awaiting_review') {
          setNotice(t('photos.awaiting_review'));
        }
      },
      onError: (error) => {
        const code = error instanceof Error ? error.message : 'internal_error';

        setNotice(
          code === 'photo_limit_reached'
            ? t('photos.limit_reached', { count: MAX_PHOTOS })
            : t('photos.upload_failed'),
        );
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
    reorder.mutate(next);
  };

  return (
    <Screen scroll className="gap-8 py-8">
      <View className="gap-3">
        <Text variant="title">{t('profile.photos')}</Text>
        <Text tone="muted">{t('photos.subtitle')}</Text>
      </View>

      <PhotoGrid
        photos={ordered}
        busy={busy}
        onAdd={add}
        onDelete={(photo) => {
          setNotice(null);
          remove.mutate(photo.id);
        }}
        onMove={move}
      />

      {notice ? (
        <Text variant="caption" tone="muted">
          {notice}
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
