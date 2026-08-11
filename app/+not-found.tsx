import { View } from 'react-native';
import Head from 'expo-router/head';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';
import { APP_NAME } from '@/lib/app';

// Without this file expo-router serves its own unstyled fallback, whose copy is
// hardcoded English and whose tab title is empty. A mistyped or stale link is
// the first thing a stranger sees of the product, so it gets the same treatment
// as any other screen.
//
// Its own Head because the root layout's is gated on route focus, and this
// route is rendered outside that.
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <Screen className="justify-center gap-6">
      <Head>
        <title>{APP_NAME}</title>
      </Head>

      <View className="gap-5">
        <View className="h-px w-12 bg-brand" />

        <Text variant="title">{t('not_found.title')}</Text>
        <Text tone="muted">{t('not_found.body')}</Text>
      </View>

      <Button label={t('not_found.go_home')} onPress={() => router.replace('/')} />
    </Screen>
  );
}
