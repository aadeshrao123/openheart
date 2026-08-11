import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Screen, Text } from '@/components/ui';
import { useSignOut } from '@/hooks/use-auth';

export type SuspendedViewProps = {
  reason: string | null;
};

// Rendered in place of the app rather than pushed as a route, so there is no
// way to navigate around it and no redirect loop to get wrong.
//
// It says what happened and does not say who reported them. A suspension that
// names its source turns a report into a target.
export function SuspendedView({ reason }: SuspendedViewProps) {
  const { t } = useTranslation();
  const signOut = useSignOut();

  return (
    <Screen className="justify-center gap-6">
      <View className="gap-5">
        <View className="h-px w-12 bg-danger" />

        <Text variant="title">{t('suspended.title')}</Text>

        <Text tone="muted">{t('suspended.body')}</Text>

        {reason ? (
          <View className="border-s-2 border-danger ps-5">
            <Text tone="default">{reason}</Text>
          </View>
        ) : null}

        <Text variant="caption" tone="subtle">
          {t('suspended.appeal')}
        </Text>
      </View>

      <Button
        variant="secondary"
        label={t('settings.sign_out')}
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
      />
    </Screen>
  );
}
