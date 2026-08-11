import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Screen, Text } from '@/components/ui';
import { APP_NAME } from '@/lib/app';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen className="justify-center gap-10">
      <View className="gap-3">
        <Text variant="display">{APP_NAME}</Text>
        <Text variant="heading" tone="muted">
          {t('welcome.tagline')}
        </Text>
      </View>

      <Card className="gap-2">
        <Text variant="label" tone="brand">
          {t('welcome.promise_title')}
        </Text>
        <Text tone="muted">{t('welcome.promise_body')}</Text>
      </Card>
    </Screen>
  );
}
