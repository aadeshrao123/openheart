import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Screen, Text } from '@/components/ui';
import { APP_NAME } from '@/lib/app';

// Shown while the gate works out where the user belongs. Carries the app name so
// the first frame after launch reads as loading rather than broken.
export function SplashView() {
  const { t } = useTranslation();

  return (
    <Screen className="items-center justify-center gap-6">
      <Text variant="display">{APP_NAME}</Text>

      <View accessibilityRole="progressbar" accessibilityLabel={t('common.loading')}>
        <ActivityIndicator />
      </View>
    </Screen>
  );
}
