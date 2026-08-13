import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Linking from 'expo-linking';
import { Avatar, Button, Card, Chip, ListRow, Screen, Section, Text } from '@/components/ui';
import { useSignOut } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useSoundPreference } from '@/hooks/use-sound-preference';
import { useDeleteAccount, useMyProfile } from '@/hooks/use-my-profile';
import { useSession } from '@/hooks/use-session';
import { useIsModerator } from '@/hooks/use-moderation';
import { DELETION_URL, PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_URL } from '@/lib/app';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: profile } = useMyProfile();
  const language = useLanguage();
  const sounds = useSoundPreference();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();
  const isModerator = useIsModerator();

  // Two steps rather than Alert.alert. Deletion is irreversible, an Alert on web
  // is a browser dialog that is easy to dismiss by reflex, and this way the
  // consequences are on screen next to the button that carries them out.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const open = (url: string) => () => {
    void Linking.openURL(url);
  };

  return (
    <Screen scroll className="gap-10 py-8">
      <Text variant="title">{t('settings.title')}</Text>

      <Card className="flex-row items-center gap-4">
        <Avatar name={profile?.display_name ?? ''} identity={profile?.id} size="lg" />

        <View className="flex-1 gap-0.5">
          <Text variant="heading">{profile?.display_name ?? ''}</Text>

          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {session?.user.email ?? ''}
          </Text>
        </View>

        <Chip label={t('home.edit_profile')} onPress={() => router.push('/edit-profile')} />
      </Card>

      <Section title={t('settings.account')}>
        <Card elevation="flat" className="gap-0 px-0">
          <ListRow label={t('home.edit_profile')} onPress={() => router.push('/edit-profile')} />
          <ListRow label={t('photos.title')} onPress={() => router.push('/photos')} />
          <ListRow label={t('filters.title')} onPress={() => router.push('/filters')} />
          <ListRow label={t('safety.blocked_title')} onPress={() => router.push('/blocked')} />
        </Card>
      </Section>

      <Section title={t('settings.sounds')} description={t('settings.sounds_body')}>
        <Chip
          mode="checkbox"
          label={t('settings.sounds_on')}
          selected={!sounds.muted}
          onPress={sounds.toggle}
          className="self-start"
        />
      </Section>

      <Section title={t('settings.language')}>
        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
          {Object.entries(language.available).map(([code, name]) => (
            <Chip
              key={code}
              mode="radio"
              label={name}
              selected={language.current === code}
              // Only the keys of SUPPORTED_LANGUAGES reach here, so the cast is
              // recovering what Object.entries widened away.
              onPress={() => void language.setLanguage(code as typeof language.current)}
            />
          ))}
        </View>

        {/* Native only. Layout direction is read once while laying out, so
            switching between an LTR and an RTL language changes every string
            immediately and leaves the layout facing the old way until the app
            is relaunched. */}
        {language.needsRestart ? (
          <Text variant="caption" tone="accent">
            {t('settings.language_restart')}
          </Text>
        ) : null}
      </Section>

      {isModerator ? (
        <Section title={t('moderation.title')}>
          <Card elevation="flat" className="gap-0 px-0">
            <ListRow
              label={t('moderation.open_queue')}
              onPress={() => router.push('/moderation')}
            />
            <ListRow
              label={t('review.open_queue')}
              onPress={() => router.push('/verification-reviews')}
            />
          </Card>
        </Section>
      ) : null}

      {/* The address is shown as well as linked: openURL does nothing on a
          device with no mail client, and a row that silently fails is worse
          than an address somebody can copy. */}
      <Section title={t('settings.help')} description={t('settings.contact_body')}>
        <Card elevation="flat" className="gap-0 px-0">
          <ListRow
            label={t('settings.contact')}
            value={SUPPORT_EMAIL}
            onPress={open(`mailto:${SUPPORT_EMAIL}`)}
          />
          <ListRow label={t('settings.privacy_policy')} onPress={open(PRIVACY_POLICY_URL)} />
          <ListRow label={t('settings.terms')} onPress={open(TERMS_URL)} />
          <ListRow label={t('settings.deletion_policy')} onPress={open(DELETION_URL)} />
        </Card>
      </Section>

      <Button
        variant="secondary"
        label={t('settings.sign_out')}
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />

      <Section title={t('settings.danger_zone')}>
        {confirmingDelete ? (
          <Card className="gap-4 border-danger">
            <Text variant="label" tone="danger">
              {t('settings.delete_account')}
            </Text>
            <Text tone="muted">{t('settings.delete_confirm')}</Text>
            <Text variant="caption" tone="subtle">
              {t('settings.delete_retains_messages')}
            </Text>

            {deleteAccount.isError ? (
              <Text variant="caption" tone="danger" role="alert">
                {t('common.error_generic')}
              </Text>
            ) : null}

            <Button
              variant="danger"
              label={t('settings.delete_confirm_action')}
              loading={deleteAccount.isPending}
              onPress={() => deleteAccount.mutate()}
            />

            <Button
              variant="ghost"
              label={t('common.cancel')}
              onPress={() => setConfirmingDelete(false)}
            />
          </Card>
        ) : (
          <Button
            variant="danger"
            label={t('settings.delete_account')}
            onPress={() => setConfirmingDelete(true)}
          />
        )}
      </Section>

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
