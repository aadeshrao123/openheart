import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Rail, Screen, Skeleton, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { useMatchProfile } from '@/hooks/use-match-profile';
import { useHideThread, useThread, useThreads, useUnmatch } from '@/hooks/use-threads';
import { ageOn, fromDateColumn } from '@/lib/age';
import { photoUrl } from '@/lib/photos';
import { isGender } from '@/lib/profile-options';
import { SafetyActions } from '@/components/safety-actions';

// Matches the shape of the loaded page: a photo, the name line, then the bio.
function MatchProfileSkeleton() {
  const { t } = useTranslation();

  return (
    <Screen scroll className="gap-6 py-6">
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.loading')}
        aria-busy
        className="gap-6"
      >
        <Skeleton shape="card" />

        <View className="gap-2">
          <Skeleton shape="title" className="w-2/3" />
          <Skeleton shape="caption" className="w-1/4" />
        </View>

        <Skeleton shape="block" />
      </View>
    </Screen>
  );
}

export default function MatchProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';

  const threads = useThreads();
  const thread = useThread(matchId);
  const matchProfile = useMatchProfile(thread?.other_id);
  const profile = matchProfile.data;

  const unmatch = useUnmatch();
  const hide = useHideThread();
  const [confirming, setConfirming] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  // Before the thread lookup below. A failed read leaves no thread to find, and
  // falling through to that redirect told the user the match no longer exists.
  if (threads.isError) {
    return (
      <LoadFailed
        retrying={threads.isFetching}
        onRetry={() => {
          void threads.refetch();
        }}
      />
    );
  }

  if (threads.isPending) {
    return <MatchProfileSkeleton />;
  }

  if (!thread) {
    return <Redirect href="/matches" />;
  }

  // After the redirect, not with it: the profile query is disabled until the
  // thread names an id, so a missing thread would leave this pending forever.
  if (matchProfile.isPending) {
    return <MatchProfileSkeleton />;
  }

  const deleted = thread.other_deleted;
  const name = deleted ? t('chat.deleted_account') : thread.other_name;
  const birthdate = profile?.birthdate ? fromDateColumn(profile.birthdate) : null;
  const age = birthdate ? ageOn(birthdate, new Date()) : null;
  const photos = (profile?.photos ?? []).slice().sort((a, b) => a.position - b.position);

  return (
    <Screen scroll className="gap-6 py-6">
      {photos[0] ? (
        <View className="aspect-card overflow-hidden rounded-card bg-surface">
          <Image
            source={{ uri: photoUrl(photos[0].r2_key, 'full') }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('profile.photo_alt', { name })}
          />
        </View>
      ) : null}

      <View className="gap-2">
        <Text variant="title">
          {age !== null ? t('deck.name_age', { name, age }) : name}
        </Text>

        {profile?.gender && isGender(profile.gender) ? (
          <Text variant="overline" tone="accent">
            {t(`profile.gender_${profile.gender}`)}
          </Text>
        ) : null}
      </View>

      {/* Inline rather than a full-screen LoadFailed. The name, the unmatch and
          the report and block below all come from the thread, which loaded, and
          replacing the page would take the safety actions away over a photo
          that did not arrive. Saying nothing was the other failure: an empty
          page reads as a person who wrote no bio and posted no photo. */}
      {matchProfile.isError ? (
        <Card className="gap-3" role="alert">
          <Text variant="label">{t('common.load_failed_title')}</Text>
          <Text tone="muted">{t('common.load_failed_body')}</Text>

          <Button
            variant="secondary"
            size="sm"
            label={t('common.retry')}
            loading={matchProfile.isFetching}
            onPress={() => {
              void matchProfile.refetch();
            }}
          />
        </Card>
      ) : null}

      {profile?.bio ? (
        <Card elevation="flat">
          <Text>{profile.bio}</Text>
        </Card>
      ) : null}

      {photos.slice(1).map((photo) => (
        <View key={photo.r2_key} className="aspect-card overflow-hidden rounded-card bg-surface">
          <Image
            source={{ uri: photoUrl(photo.r2_key, 'full') }}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            accessibilityLabel={t('profile.photo_alt', { name })}
          />
        </View>
      ))}

      <Rail tone="border" className="gap-3">
        <Text variant="overline" tone="subtle">
          {t('chat.manage_title')}
        </Text>

        {!thread.unmatched ? (
          <>
            <Button
              variant={confirming ? 'danger' : 'secondary'}
              size="sm"
              label={confirming ? t('chat.unmatch_confirm') : t('matches.unmatch')}
              loading={unmatch.isPending}
              onPress={() => {
                if (!confirming) {
                  setConfirming(true);
                  return;
                }

                unmatch.mutate(matchId, { onSuccess: () => router.replace('/matches') });
              }}
            />

            {/* Success navigates away, so with nothing rendered here a failure
                looked exactly like a screen that had not been tapped yet. */}
            {unmatch.isError ? (
              <Text variant="caption" tone="danger" role="alert">
                {t('common.error_generic')}
              </Text>
            ) : null}

            <Text variant="caption" tone="subtle">
              {t('chat.unmatch_explainer')}
            </Text>
          </>
        ) : null}

        <Button
          variant="ghost"
          size="sm"
          label={t('chat.hide')}
          loading={hide.isPending}
          onPress={() => hide.mutate(matchId, { onSuccess: () => router.replace('/matches') })}
        />

        {hide.isError ? (
          <Text variant="caption" tone="danger" role="alert">
            {t('common.error_generic')}
          </Text>
        ) : null}

        <Text variant="caption" tone="subtle">
          {t('chat.hide_explainer')}
        </Text>

        <Button
          variant="ghost"
          size="sm"
          label={t('safety.title', { name })}
          onPress={() => setSafetyOpen(true)}
        />
      </Rail>

      <Button
        variant="secondary"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/matches'))}
      />

      <SafetyActions
        visible={safetyOpen}
        name={name}
        targetId={thread.other_id}
        matchId={matchId}
        onClose={() => setSafetyOpen(false)}
        onBlocked={() => router.replace('/matches')}
      />
    </Screen>
  );
}
