import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { useMyProfile } from '@/hooks/use-my-profile';

// Shown when the profile read fails rather than returning no row. Every layout
// that consults the gate renders this for that state, because the alternative
// is falling through to whichever branch happens to be next: before this
// existed, a failed read looked exactly like having no profile and sent an
// existing user into signup.
//
// Retry refetches the same query the gate is waiting on, so a recovered network
// resolves the gate on its own without a relaunch.
export function GateErrorView() {
  const { t } = useTranslation();
  const { refetch, isFetching } = useMyProfile();

  return (
    <Screen className="justify-center gap-6">
      <View className="gap-2">
        <Text variant="title">{t('error.title')}</Text>
        <Text tone="muted">{t('error.body')}</Text>
      </View>

      <Button
        label={t('common.retry')}
        loading={isFetching}
        onPress={() => {
          void refetch();
        }}
      />
    </Screen>
  );
}
