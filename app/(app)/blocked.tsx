import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Avatar, Button, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { useBlocks, useUnblock } from '@/hooks/use-safety';

function BlockedHeader() {
  const { t } = useTranslation();

  return (
    <View className="gap-2">
      <View className="h-px w-12 bg-brand" />
      <Text variant="title">{t('safety.blocked_title')}</Text>
      <Text tone="muted">{t('safety.blocked_body')}</Text>
    </View>
  );
}

// Matches the shape of a blocked row: avatar, then the name, then the button.
function BlockedListSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="gap-6"
    >
      {[0, 1, 2].map((row) => (
        <View key={row} className="flex-row items-center gap-4">
          <Skeleton shape="avatar" />

          <View className="flex-1">
            <Skeleton shape="line" className="w-1/2" />
          </View>

          <Skeleton shape="line" className="w-1/5" />
        </View>
      ))}
    </View>
  );
}

export default function BlockedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: blocks, isPending, isError, isFetching, refetch } = useBlocks();
  const unblock = useUnblock();

  if (isPending) {
    return (
      <Screen scroll className="gap-6 py-6">
        <BlockedHeader />
        <BlockedListSkeleton />
      </Screen>
    );
  }

  // Before the empty state, not after it. A failed read used to render "You
  // have not blocked anyone", which tells someone a safety control they set is
  // gone and invites them to stop relying on it.
  if (isError) {
    return (
      <LoadFailed
        retrying={isFetching}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  }

  return (
    <Screen
      scroll
      className="gap-6 py-6"
      refreshing={isFetching}
      onRefresh={() => {
        void refetch();
      }}
    >
      <BlockedHeader />

      {blocks.length === 0 ? (
        <EmptyState icon="shield" body={t('safety.blocked_empty')} />
      ) : (
        <View className="gap-6">
          {blocks.map((block) => {
            // variables is the id handed to the mutate call in flight, so one
            // shared mutation can still say which row is busy or failed.
            const isRowPending = unblock.isPending && unblock.variables === block.blocked_id;
            const hasRowFailed = unblock.isError && unblock.variables === block.blocked_id;

            return (
              <View key={block.blocked_id} className="gap-2">
                <View className="flex-row items-center gap-4">
                  <Avatar name={block.profiles?.display_name ?? '?'} size="md" />

                  <Text variant="label" className="flex-1" numberOfLines={1}>
                    {block.profiles?.display_name || t('safety.blocked_unknown')}
                  </Text>

                  <Button
                    variant="ghost"
                    size="sm"
                    label={t('safety.unblock')}
                    loading={isRowPending}
                    onPress={() => unblock.mutate(block.blocked_id)}
                  />
                </View>

                {hasRowFailed ? (
                  <Text variant="caption" tone="danger" role="alert">
                    {t('common.error_generic')}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <Text variant="caption" tone="subtle">
        {t('safety.unblock_explainer')}
      </Text>

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
