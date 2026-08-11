import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { useReleasePolicy } from '@/hooks/use-release-policy';
import { APP_NAME } from '@/lib/app';

// Wraps the whole router. A client below minimum_supported_version renders
// this instead of the app, because the reason for raising that floor is
// usually that the old client is doing something harmful.
//
// There is deliberately no store link yet: the bundle identifier is still an
// open decision, and a button to a URL that does not exist is worse than no
// button. Retry covers the real flow, where the user updates through the store
// and returns to a still-running app.
export function VersionGate({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  const { mustUpdate, isFetching, refetch } = useReleasePolicy();

  // Fails open by construction: mustUpdate is false while the policy is
  // loading and stays false if the request never succeeds, so an outage cannot
  // lock anyone out of an app that is already installed.
  if (!mustUpdate) {
    return <>{children}</>;
  }

  return (
    <Screen className="justify-center gap-6">
      <View className="gap-2">
        <Text variant="title">{t('update.title')}</Text>
        <Text tone="muted">{t('update.body', { appName: APP_NAME })}</Text>
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
