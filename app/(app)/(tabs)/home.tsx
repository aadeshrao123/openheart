import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card, ListRow, Screen, Skeleton, Text } from '@/components/ui';
import { useMyProfile } from '@/hooks/use-my-profile';
import { useUpdateLocation } from '@/hooks/use-location';
import { ageOn, fromDateColumn } from '@/lib/age';

// Matches the shape of the loaded screen: avatar beside a name, then the rows.
function HomeSkeleton() {
  const { t } = useTranslation();

  return (
    <Screen scroll className="gap-8 py-8">
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={t('common.loading')}
        aria-busy
        className="gap-8"
      >
        <View className="flex-row items-center gap-4">
          <Skeleton shape="avatar" />

          <View className="flex-1 gap-2">
            <Skeleton shape="heading" className="w-1/2" />
            <Skeleton shape="caption" className="w-1/3" />
          </View>
        </View>

        <View className="gap-1">
          {[0, 1, 2, 3, 4].map((row) => (
            <View key={row} className="px-4 py-3">
              <Skeleton shape="line" className="w-2/3" />
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: profile } = useMyProfile();
  const updateLocation = useUpdateLocation();

  // The layout gate resolves the profile before this renders, so no path gets
  // here without one. It loads rather than returning null anyway: if that ever
  // stops holding, a blank screen is the one failure a user cannot act on.
  if (!profile) {
    return <HomeSkeleton />;
  }

  const birthdate = fromDateColumn(profile.birthdate);
  const age = birthdate ? ageOn(birthdate, new Date()) : null;

  // A refused permission is a value, not a throw, so isError alone misses it,
  // and 'unavailable' is in LocationResult but unreturned today. Covering all
  // three means no outcome stops the spinner and leaves the card saying nothing.
  const locationFailure =
    updateLocation.data === 'denied'
      ? t('home.location_denied')
      : updateLocation.isError || updateLocation.data === 'unavailable'
        ? t('common.error_generic')
        : null;

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

          {locationFailure ? (
            <Text variant="caption" tone="danger" role="alert">
              {locationFailure}
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

      {/* Browsing and messages are tabs now, so they are not repeated here.
          What is left is the set of things somebody does once. */}
      <View className="gap-1">
        {!profile.photo_verified ? (
          <ListRow label={t('home.verify')} onPress={() => router.push('/verify')} />
        ) : null}

        <ListRow label={t('home.edit_profile')} onPress={() => router.push('/edit-profile')} />
        <ListRow label={t('profile.photos')} onPress={() => router.push('/photos')} />
        <ListRow label={t('settings.title')} onPress={() => router.push('/settings')} />
        <ListRow label={t('safety.blocked_title')} onPress={() => router.push('/blocked')} />
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
