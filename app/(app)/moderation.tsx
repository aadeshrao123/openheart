import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, EmptyState, Screen, Skeleton, Text } from '@/components/ui';
import { LoadFailed } from '@/components/load-failed';
import { ReportCard } from '@/components/report-card';
import { useIsModerator, useReports } from '@/hooks/use-moderation';

// Matches the shape of ReportCard: reason overline, target name, filed-at line,
// then the resolve actions.
function ReportQueueSkeleton() {
  const { t } = useTranslation();

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={t('common.loading')}
      aria-busy
      className="gap-6"
    >
      {[0, 1, 2].map((card) => (
        <Card key={card} className="gap-4">
          <View className="gap-2">
            <Skeleton shape="caption" className="w-1/4" />
            <Skeleton shape="heading" className="w-1/2" />
            <Skeleton shape="caption" className="w-2/5" />
          </View>

          <View className="gap-2">
            <Skeleton shape="line" className="h-10" />
            <Skeleton shape="line" className="h-10" />
          </View>
        </Card>
      ))}
    </View>
  );
}

// A queue, not a product. It exists so a human can read a report and act on it,
// and the RPC behind it checks is_moderator again, so rendering this screen to
// the wrong person shows them an empty list rather than anyone's data.
export default function ModerationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isModerator = useIsModerator();
  const [includeResolved, setIncludeResolved] = useState(false);
  const { data: reports, isPending, isError, isFetching, refetch } = useReports(includeResolved);

  // Ahead of every query state on purpose: useReports is disabled for anyone who
  // is not a moderator, so isPending never clears for them and a skeleton placed
  // first would spin for as long as they stayed here.
  if (!isModerator) {
    return (
      <Screen className="justify-center gap-5">
        <Text variant="title">{t('moderation.title')}</Text>
        <Text tone="muted">{t('moderation.not_a_moderator')}</Text>
        <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  // Before the empty state, not after it. A queue that could not load used to
  // say "Nothing waiting. That is the good outcome", and a moderator acts on
  // that by closing the tab.
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

  const rows = reports ?? [];
  const isEmpty = !isPending && rows.length === 0;

  // The filters stay mounted through loading: switching one starts a fresh
  // query, and unmounting the chips under the moderator would take the focus
  // with them.
  return (
    <Screen
      scroll
      className="gap-6 py-6"
      refreshing={isFetching && !isPending}
      onRefresh={() => {
        void refetch();
      }}
    >
      <View className="gap-2">
        <View className="h-px w-12 bg-brand" />
        <Text variant="title">{t('moderation.title')}</Text>
      </View>

      <View accessibilityRole="radiogroup" className="flex-row gap-2">
        <Chip
          mode="radio"
          label={t('moderation.filter_pending')}
          selected={!includeResolved}
          onPress={() => setIncludeResolved(false)}
        />
        <Chip
          mode="radio"
          label={t('moderation.filter_all')}
          selected={includeResolved}
          onPress={() => setIncludeResolved(true)}
        />
      </View>

      {isPending ? <ReportQueueSkeleton /> : null}

      {/* A tick, not a heart. An empty moderation queue is good news and should
          look like it rather than like a screen that failed to load. */}
      {isEmpty ? <EmptyState icon="check" body={t('moderation.empty')} /> : null}

      {rows.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
