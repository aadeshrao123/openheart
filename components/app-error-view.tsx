import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { ErrorBoundaryProps } from 'expo-router';
import { Button, Card, Screen, Text } from '@/components/ui';

// Carries its own SafeAreaProvider: the router swaps this in for the root
// layout, so when the layout is what threw, the provider it rendered is gone.
export function AppErrorView({ error, retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();

  return (
    <SafeAreaProvider>
      <Screen className="justify-center gap-6">
        <View className="gap-2">
          <Text variant="title">{t('error.title')}</Text>
          <Text tone="muted">{t('error.body')}</Text>
        </View>

        {/* Developer text, so it is not translated and not shown in a release
            build: it leaks internals and reads as noise to a user. */}
        {__DEV__ ? (
          <Card elevation="flat">
            <Text variant="caption" tone="subtle">
              {error.message}
            </Text>
          </Card>
        ) : null}

        <Button
          label={t('common.retry')}
          onPress={() => {
            void retry();
          }}
        />
      </Screen>
    </SafeAreaProvider>
  );
}
