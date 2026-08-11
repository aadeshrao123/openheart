import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card, ListRow, Screen, Text } from '@/components/ui';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useUpdateLocation } from '@/hooks/use-location';
import { ageOn, fromDateColumn } from '@/lib/age';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const updateLocation = useUpdateLocation();

  // The layout gate already guarantees a profile before this renders, so this
  // only satisfies the type.
  if (!profile) {
    return null;
  }

  const birthdate = fromDateColumn(profile.birthdate);
  const age = birthdate ? ageOn(birthdate, new Date()) : null;

  return (
    <Screen scroll className="gap-8 py-8">
      <View className="flex-row items-center gap-4">
        <Avatar name={profile.display_name} size="lg" />

        <View className="shrink gap-1">
          <Text variant="title" numberOfLines={1}>
            {profile.display_name}
          </Text>

          {age !== null ? <Text tone="muted">{t('profile.age_years', { age })}</Text> : null}
        </View>
      </View>

      {/* photo_verified is the anti-bot gate and is service-role only, so this
          stays until a real verification passes. It is the reason a new profile
          is not in anyone's deck yet, and saying so beats an empty deck with no
          explanation. */}
      {!profile.photo_verified ? (
        <Card className="gap-2">
          <Text variant="label" tone="brand">
            {t('home.not_visible_title')}
          </Text>
          <Text tone="muted">{t('profile.verify_prompt')}</Text>
        </Card>
      ) : null}

      {profile.location === null ? (
        <Card className="gap-3">
          <Text variant="label">{t('home.location_title')}</Text>
          <Text tone="muted">{t('home.location_body')}</Text>

          {updateLocation.data === 'denied' ? (
            <Text variant="caption" tone="danger">
              {t('home.location_denied')}
            </Text>
          ) : null}

          <Button
            size="sm"
            label={t('home.location_enable')}
            loading={updateLocation.isPending}
            onPress={() => updateLocation.mutate()}
          />
        </Card>
      ) : null}

      <View className="gap-1">
        <ListRow label={t('home.browse')} onPress={() => router.push('/deck')} />
        <ListRow
          label={t('home.edit_profile')}
          onPress={() => router.push('/edit-profile')}
        />
        <ListRow label={t('profile.photos')} onPress={() => router.push('/photos')} />
        <ListRow label={t('settings.title')} onPress={() => router.push('/settings')} />
      </View>

      <Card elevation="flat" className="gap-2">
        <Text variant="label" tone="muted">
          {t('home.next_title')}
        </Text>
        <Text variant="caption" tone="subtle">
          {t('home.next_body')}
        </Text>
      </Card>
    </Screen>
  );
}
