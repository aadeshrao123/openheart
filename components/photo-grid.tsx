import { Pressable, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Icon, Skeleton, Text, type IconProps } from '@/components/ui';
import { cn } from '@/lib/cn';
import { photoUrl } from '@/lib/photos';
import { MAX_PHOTOS, type Photo } from '@/hooks/use-photos';

// Two columns, not three. A 390pt phone leaves a three-column slot about 101pt
// wide, and 44pt is the floor for a touch target, so only two controls fit in a
// row under the tile. Delete is the third and sits on the image instead, which
// also stops a destructive control from touching the two pressed repeatedly.
const COLUMNS = 2;

const tones = {
  default: 'text-fg-muted',
  danger: 'text-danger',
} as const;

// The chevron points at the starting edge and mirrors with the language, so
// "earlier" is the plain icon in both directions of text. "later" is always its
// opposite, and a wrapper transform composes with the mirroring the primitive
// does rather than fighting it.
const facings = {
  start: undefined,
  end: { transform: [{ scaleX: -1 }] } as ViewStyle,
} as const;

type Tone = keyof typeof tones;
type Facing = keyof typeof facings;

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, row) =>
    items.slice(row * size, row * size + size),
  );
}

export type PhotoGridProps = {
  photos: Photo[];
  busy?: boolean;
  onAdd: (position: number) => void;
  onDelete: (photo: Photo) => void;
  onMove: (photo: Photo, direction: -1 | 1) => void;
};

export function PhotoGrid({ photos, busy = false, onAdd, onDelete, onMove }: PhotoGridProps) {
  const byPosition = new Map(photos.map((photo) => [photo.position, photo]));
  const slots = Array.from({ length: MAX_PHOTOS }, (_, position) => {
    const photo = byPosition.get(position) ?? null;

    // Rank in the list, not the position column: a delete leaves a hole, so the
    // last photo is no longer at position count - 1, and it used to offer a
    // "move later" that did nothing.
    return { position, photo, index: photo ? photos.indexOf(photo) : -1 };
  });

  return (
    <View className="gap-3">
      {chunk(slots, COLUMNS).map((row) => (
        <View key={row[0].position} className="flex-row items-start gap-3">
          {row.map((slot) => (
            <Slot
              key={slot.position}
              position={slot.position}
              photo={slot.photo}
              busy={busy}
              isFirst={slot.index === 0}
              isLast={slot.index === photos.length - 1}
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

export function PhotoGridSkeleton() {
  const { t } = useTranslation();
  const slots = Array.from({ length: MAX_PHOTOS }, (_, position) => position);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="gap-3"
    >
      {chunk(slots, COLUMNS).map((row) => (
        <View key={row[0]} className="flex-row items-start gap-3">
          {row.map((slot) => (
            <Skeleton key={slot} shape="card" className="flex-1" />
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
  isFirst: boolean;
  isLast: boolean;
  onAdd: (position: number) => void;
  onDelete: (photo: Photo) => void;
  onMove: (photo: Photo, direction: -1 | 1) => void;
};

function Slot({ position, photo, busy, isFirst, isLast, onAdd, onDelete, onMove }: SlotProps) {
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
          busy ? 'opacity-50' : 'bg-surface hover:bg-surface-hover active:bg-surface-pressed',
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
          // py-12 keeps the longest translation clear of the remove button.
          <View className="flex-1 items-center justify-center px-3 py-12">
            <Text variant="caption" tone={rejected ? 'danger' : 'subtle'} className="text-center">
              {rejected ? t('profile.photo_rejected') : t('profile.photo_pending_review')}
            </Text>
          </View>
        )}

        <SlotAction
          label={t('photos.delete_at', { position: position + 1 })}
          icon="close"
          tone="danger"
          disabled={busy}
          onPress={() => onDelete(photo)}
          className={cn(
            'absolute end-1 top-1 rounded-full border border-border',
            'bg-surface-raised hover:bg-surface-hover active:bg-surface-pressed',
          )}
        />
      </View>

      <View className="flex-row justify-between">
        <SlotAction
          label={t('photos.move_earlier')}
          icon="chevron"
          disabled={busy || isFirst}
          onPress={() => onMove(photo, -1)}
        />
        <SlotAction
          label={t('photos.move_later')}
          icon="chevron"
          facing="end"
          disabled={busy || isLast}
          onPress={() => onMove(photo, 1)}
        />
      </View>
    </View>
  );
}

type SlotActionProps = {
  label: string;
  icon: IconProps['name'];
  facing?: Facing;
  tone?: Tone;
  disabled: boolean;
  onPress: () => void;
  className?: string;
};

function SlotAction({
  label,
  icon,
  facing = 'start',
  tone = 'default',
  disabled,
  onPress,
  className,
}: SlotActionProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-control',
        disabled ? 'opacity-30' : 'hover:bg-surface-hover active:bg-surface-pressed',
        className,
      )}
    >
      <View style={facings[facing]}>
        <Icon name={icon} className={tones[tone]} />
      </View>
    </Pressable>
  );
}
