import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from 'react-i18next';
import { Button, Card, Icon, Text, TextArea } from '@/components/ui';
import { VerifiedBadge } from '@/components/verified-badge';
import { cn } from '@/lib/cn';
import { formatDistance, formatHeight } from '@/lib/format';
import { photoUrl } from '@/lib/photos';
import { LIFESTYLE_FIELDS } from '@/lib/profile-options';
import { readPrompts } from '@/components/profile-details';
import type { Candidate } from '@/hooks/use-discovery';

export type LikeTarget = {
  likedPhotoId?: string | null;
  likedPrompt?: string | null;
  comment?: string | null;
};

export type ProfileScrollProps = {
  candidate: Candidate;
  onLike: (target: LikeTarget) => void;
  onPass: () => void;
  busy?: boolean;
};

const COMMENT_MAX = 240;

// A profile is read top to bottom, with the photos between the things somebody
// wrote rather than all stacked at the front. A single hero photo and a wall of
// text underneath is a profile people scroll past; alternating them is why
// Hinge profiles get read.
function Block({ children, className }: { children: ReactNode; className?: string }) {
  return <View className={cn('gap-3', className)}>{children}</View>;
}

// Every likeable piece carries its own button. Liking the whole person is one
// tap on the bar at the bottom; liking one photo or one answer is what gives
// the other person something to reply to.
function Likeable({
  label,
  active,
  onPress,
  children,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <View className="relative">
      {children}

      <View className="absolute bottom-3 end-3">
        <Button
          variant={active ? 'primary' : 'secondary'}
          size="sm"
          label={label}
          leading={
            <Icon
              name="check"
              size="sm"
              className={active ? 'text-fg-inverted' : 'text-brand'}
            />
          }
          onPress={onPress}
        />
      </View>
    </View>
  );
}

export function ProfileScroll({ candidate, onLike, onPass, busy = false }: ProfileScrollProps) {
  const { t } = useTranslation();

  const [target, setTarget] = useState<LikeTarget | null>(null);
  const [comment, setComment] = useState('');

  const prompts = readPrompts(candidate.prompts);
  const photos = candidate.photoKeys;

  const facts: string[] = [];

  if (candidate.height_cm !== null) {
    facts.push(formatHeight(candidate.height_cm));
  }

  if (candidate.job_title) {
    facts.push(candidate.job_title);
  }

  if (candidate.education) {
    facts.push(t(`profile.education_${candidate.education}`));
  }

  if (candidate.children) {
    facts.push(t(`profile.children_${candidate.children}`));
  }

  for (const { field, summary } of LIFESTYLE_FIELDS) {
    const value = candidate[field];

    if (value && value !== 'prefer_not_say') {
      facts.push(t(summary, { value: t(`profile.frequency_${value}`) }));
    }
  }

  const interests = candidate.interests ?? [];

  const picked = (next: LikeTarget) =>
    target?.likedPhotoId === next.likedPhotoId && target?.likedPrompt === next.likedPrompt;

  const choose = (next: LikeTarget) => setTarget(picked(next) ? null : next);

  const photo = (key: string, index: number) => (
    <Likeable
      key={key}
      label={t('deck.like_this')}
      active={picked({ likedPhotoId: key })}
      onPress={() => choose({ likedPhotoId: key })}
    >
      <View className="aspect-card overflow-hidden rounded-card bg-surface">
        <Image
          source={{ uri: photoUrl(key, index === 0 ? 'full' : 'medium') }}
          style={{ width: '100%', height: '100%' }}
          contentFit="cover"
          transition={150}
          accessibilityLabel={t('profile.photo_alt', { name: candidate.display_name })}
        />
      </View>
    </Likeable>
  );

  // Photo, then something written, then photo again. Whichever list runs out
  // first, the rest of the other simply follows.
  const body: ReactNode[] = [];
  const written: ReactNode[] = [];

  if (candidate.bio) {
    written.push(
      <Card key="bio" elevation="flat" className="gap-2 pb-14">
        <Text variant="overline" tone="subtle">
          {t('profile.bio')}
        </Text>
        <Text>{candidate.bio}</Text>
      </Card>,
    );
  }

  for (const entry of prompts) {
    written.push(
      <Likeable
        key={entry.prompt}
        label={t('deck.like_this')}
        active={picked({ likedPrompt: entry.prompt })}
        onPress={() => choose({ likedPrompt: entry.prompt })}
      >
        <Card elevation="raised" className="gap-2 pb-14">
          <Text variant="overline" tone="accent">
            {t(`profile.prompt_${entry.prompt}`)}
          </Text>
          <Text variant="quote">{entry.answer}</Text>
        </Card>
      </Likeable>,
    );
  }

  if (facts.length > 0) {
    written.push(
      <Card key="facts" elevation="flat" className="gap-3">
        <Text variant="overline" tone="subtle">
          {t('profile.section_about')}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {facts.map((fact) => (
            <View key={fact} className="rounded-control bg-surface-raised px-3 py-1.5">
              <Text variant="caption">{fact}</Text>
            </View>
          ))}
        </View>
      </Card>,
    );
  }

  if (interests.length > 0) {
    written.push(
      <Card key="interests" elevation="flat" className="gap-3">
        <Text variant="overline" tone="subtle">
          {t('profile.interests')}
        </Text>

        <View className="flex-row flex-wrap gap-2">
          {interests.map((interest) => (
            <View key={interest} className="rounded-control bg-surface-raised px-3 py-1.5">
              <Text variant="caption">{t(`profile.interest_${interest}`)}</Text>
            </View>
          ))}
        </View>
      </Card>,
    );
  }

  const longest = Math.max(photos.length, written.length);

  for (let index = 0; index < longest; index += 1) {
    if (photos[index]) {
      body.push(photo(photos[index], index));
    }

    if (written[index]) {
      body.push(written[index]);
    }
  }

  return (
    <View className="gap-5">
      <Block>
        <View className="flex-row items-center gap-3">
          <Text variant="title" className="flex-1">
            {t('deck.name_age', { name: candidate.display_name, age: candidate.age })}
          </Text>

          <VerifiedBadge compact />
        </View>

        <Text variant="label" tone="brand">
          {candidate.distance_bucket_km === 0
            ? t('deck.distance_very_close')
            : t('deck.distance_away', {
                distance: formatDistance(candidate.distance_bucket_km),
              })}
        </Text>
      </Block>

      {/* Nothing approved yet means no photo to fetch, so the initial keeps the
          profile legible instead of opening on an empty rectangle. */}
      {photos.length === 0 ? (
        <View className="aspect-card items-center justify-center rounded-card bg-brand-subtle">
          <Text variant="monogram" tone="brand" aria-hidden>
            {candidate.display_name.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
      ) : null}

      {body}

      <Card className="gap-4">
        {target ? (
          <>
            <Text variant="overline" tone="accent">
              {target.likedPrompt
                ? t('deck.liking_answer', { prompt: t(`profile.prompt_${target.likedPrompt}`) })
                : t('deck.liking_photo')}
            </Text>

            <TextArea
              accessibilityLabel={t('deck.comment_label')}
              value={comment}
              onChangeText={setComment}
              maxLength={COMMENT_MAX}
              placeholder={t('deck.comment_placeholder')}
              className="min-h-20"
            />
          </>
        ) : (
          <Text variant="caption" tone="subtle">
            {t('deck.like_hint')}
          </Text>
        )}

        <View className="flex-row gap-3">
          <Button
            variant="secondary"
            label={t('deck.pass')}
            className="flex-1"
            disabled={busy}
            onPress={onPass}
          />

          <Button
            label={target ? t('deck.send_like') : t('deck.like')}
            className="flex-1"
            loading={busy}
            onPress={() => onLike({ ...target, comment })}
          />
        </View>
      </Card>
    </View>
  );
}
