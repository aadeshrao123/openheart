import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, ListRow, Screen, Text } from '@/components/ui';
import { useSignOut } from '@/hooks/use-auth';
import { useLanguage } from '@/hooks/use-language';
import { useDeleteAccount, useMyProfile } from '@/hooks/use-my-profile';
import { useSession } from '@/hooks/use-session';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: profile } = useMyProfile();
  const language = useLanguage();
  const signOut = useSignOut();
  const deleteAccount = useDeleteAccount();

  // Two steps rather than Alert.alert. Deletion is irreversible, an Alert on web
  // is a browser dialog that is easy to dismiss by reflex, and this way the
  // consequences are on screen next to the button that carries them out.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <Screen scroll className="gap-8 py-8">
      <Text variant="title">{t('settings.title')}</Text>

      <View className="gap-3">
        <Text variant="label" tone="muted" className="px-4">
          {t('settings.account')}
        </Text>

        <Card elevation="flat" className="gap-0 px-0">
          <ListRow label={t('settings.email')} value={session?.user.email ?? ''} />
          <ListRow label={t('profile.display_name')} value={profile?.display_name ?? ''} />
          <ListRow label={t('home.edit_profile')} onPress={() => router.push('/edit-profile')} />
        </Card>
      </View>

      <View className="gap-3">
        <Text variant="label" tone="muted" className="px-4">
          {t('settings.language')}
        </Text>

        <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2 px-4">
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
      </View>

      <View className="gap-3">
        <Button
          variant="secondary"
          label={t('settings.sign_out')}
          loading={signOut.isPending}
          onPress={() => signOut.mutate()}
        />
      </View>

      <View className="gap-3">
        <Text variant="label" tone="muted" className="px-4">
          {t('settings.danger_zone')}
        </Text>

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
              <Text variant="caption" tone="danger">
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
      </View>

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
