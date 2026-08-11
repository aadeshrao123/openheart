import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, Card, Screen, Text } from '@/components/ui';
import { useBlocks, useUnblock } from '@/hooks/use-safety';

export default function BlockedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: blocks, isPending } = useBlocks();
  const unblock = useUnblock();

  return (
    <Screen scroll className="gap-6 py-6">
      <View className="gap-2">
        <View className="h-px w-12 bg-brand" />
        <Text variant="title">{t('safety.blocked_title')}</Text>
        <Text tone="muted">{t('safety.blocked_body')}</Text>
      </View>

      {isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}

      {!isPending && (blocks ?? []).length === 0 ? (
        <Card elevation="flat">
          <Text tone="muted">{t('safety.blocked_empty')}</Text>
        </Card>
      ) : null}

      {(blocks ?? []).map((block) => (
        <View key={block.blocked_id} className="flex-row items-center gap-4">
          <Avatar name={block.profiles?.display_name ?? '?'} size="md" />

          <Text variant="label" className="flex-1" numberOfLines={1}>
            {block.profiles?.display_name || t('safety.blocked_unknown')}
          </Text>

          <Button
            variant="ghost"
            size="sm"
            label={t('safety.unblock')}
            loading={unblock.isPending}
            onPress={() => unblock.mutate(block.blocked_id)}
          />
        </View>
      ))}

      <Text variant="caption" tone="subtle">
        {t('safety.unblock_explainer')}
      </Text>

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
