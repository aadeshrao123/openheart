import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { photoUrl } from '@/lib/photos';
import { MAX_PHOTOS, type Photo } from '@/hooks/use-photos';

export type PhotoGridProps = {
  photos: Photo[];
  busy?: boolean;
  onAdd: (position: number) => void;
  onDelete: (photo: Photo) => void;
  onMove: (photo: Photo, direction: -1 | 1) => void;
};

export function PhotoGrid({ photos, busy = false, onAdd, onDelete, onMove }: PhotoGridProps) {
  const byPosition = new Map(photos.map((photo) => [photo.position, photo]));
  const slots = Array.from({ length: MAX_PHOTOS }, (_, position) => ({
    position,
    photo: byPosition.get(position) ?? null,
  }));

  const rows = [slots.slice(0, 3), slots.slice(3, 6)];

  return (
    <View className="gap-3">
      {rows.map((row, index) => (
        <View key={index} className="flex-row gap-3">
          {row.map((slot) => (
            <Slot
              key={slot.position}
              position={slot.position}
              photo={slot.photo}
              busy={busy}
              isLast={slot.position === photos.length - 1}
              onAdd={onAdd}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

type SlotProps = {
  position: number;
  photo: Photo | null;
  busy: boolean;
  isLast: boolean;
  onAdd: (position: number) => void;
  onDelete: (photo: Photo) => void;
  onMove: (photo: Photo, direction: -1 | 1) => void;
};

function Slot({ position, photo, busy, isLast, onAdd, onDelete, onMove }: SlotProps) {
  const { t } = useTranslation();
  const rejected = photo?.moderation_state === 'rejected';

  if (!photo) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('photos.add_at', { position: position + 1 })}
        aria-disabled={busy}
        disabled={busy}
        onPress={() => onAdd(position)}
        className={cn(
          'aspect-card flex-1 items-center justify-center rounded-card border border-border',
          busy ? 'opacity-50' : 'bg-surface active:bg-surface-raised',
        )}
      >
        <Text variant="title" tone="subtle" aria-hidden>
          +
        </Text>
      </Pressable>
    );
  }

  return (
    <View className="flex-1 gap-1">
      <View className="aspect-card overflow-hidden rounded-card bg-surface">
        {/* Only an approved object is fetchable through the delivery origin, so
            attempting the others would just render a broken image. */}
        {photo.moderation_state === 'approved' ? (
          <Image
            source={{ uri: photoUrl(photo.r2_key, 'thumb') }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('photos.slot', { position: position + 1 })}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-2">
            <Text
              variant="caption"
              tone={rejected ? 'danger' : 'subtle'}
            >
              {rejected ? t('profile.photo_rejected') : t('profile.photo_pending_review')}
            </Text>
          </View>
        )}
      </View>

      <View className="flex-row justify-between">
        <SlotAction
          label={t('photos.move_earlier')}
          glyph="<"
          disabled={busy || position === 0}
          onPress={() => onMove(photo, -1)}
        />
        <SlotAction
          label={t('photos.move_later')}
          glyph=">"
          disabled={busy || isLast}
          onPress={() => onMove(photo, 1)}
        />
        <SlotAction
          label={t('photos.delete_at', { position: position + 1 })}
          glyph="x"
          disabled={busy}
          tone="danger"
          onPress={() => onDelete(photo)}
        />
      </View>
    </View>
  );
}

type SlotActionProps = {
  label: string;
  glyph: string;
  disabled: boolean;
  tone?: 'default' | 'danger';
  onPress: () => void;
};

function SlotAction({ label, glyph, disabled, tone = 'default', onPress }: SlotActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-control',
        disabled ? 'opacity-30' : 'active:bg-surface',
      )}
    >
      <Text variant="label" tone={tone === 'danger' ? 'danger' : 'muted'} aria-hidden>
        {glyph}
      </Text>
    </Pressable>
  );
}
