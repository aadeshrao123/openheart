import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components/ui';

export type LoadFailedProps = {
  onRetry: () => void;
  retrying?: boolean;
};

// Every list in the app had the same hole: a failed read fell through to the
// empty state, so a moderation queue that could not load said "Nothing waiting.
// That is the good outcome", and a thread list that could not load said "No
// matches yet". Both are the most reassuring possible reading of a failure.
//
// A failed read is always actionable, so this always offers the retry rather
// than deciding for the user that it is hopeless.
export function LoadFailed({ onRetry, retrying = false }: LoadFailedProps) {
  const { t } = useTranslation();

  return (
    <Screen className="justify-center gap-6">
      <View className="gap-2">
        <View className="h-px w-12 bg-danger" />
        <Text variant="title">{t('common.load_failed_title')}</Text>
        <Text tone="muted">{t('common.load_failed_body')}</Text>
      </View>

      <Button label={t('common.retry')} loading={retrying} onPress={onRetry} />
    </Screen>
  );
}
