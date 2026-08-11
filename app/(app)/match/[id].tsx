import { useState } from 'react';
import { View } from 'react-native';
import { Image } from 'expo-image';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Text } from '@/components/ui';
import { useMatchProfile } from '@/hooks/use-match-profile';
import { useHideThread, useThread, useThreads, useUnmatch } from '@/hooks/use-threads';
import { ageOn, fromDateColumn } from '@/lib/age';
import { photoUrl } from '@/lib/photos';
import { isGender } from '@/lib/profile-options';
import { SafetyActions } from '@/components/safety-actions';

export default function MatchProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const matchId = id ?? '';

  const { isPending: threadsPending } = useThreads();
  const thread = useThread(matchId);
  const { data: profile } = useMatchProfile(thread?.other_id);

  const unmatch = useUnmatch();
  const hide = useHideThread();
  const [confirming, setConfirming] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  if (threadsPending) {
    return (
      <Screen className="justify-center">
        <Text tone="muted" className="text-center">
          {t('common.loading')}
        </Text>
      </Screen>
    );
  }

  if (!thread) {
    return <Redirect href="/matches" />;
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

      <View className="gap-3 border-s-2 border-border ps-5">
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

        <Text variant="caption" tone="subtle">
          {t('chat.hide_explainer')}
        </Text>

        <Button
          variant="ghost"
          size="sm"
          label={t('safety.title', { name })}
          onPress={() => setSafetyOpen(true)}
        />
      </View>

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
