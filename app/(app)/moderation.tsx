import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, Screen, Text } from '@/components/ui';
import { ReportCard } from '@/components/report-card';
import { useIsModerator, useReports } from '@/hooks/use-moderation';

// A queue, not a product. It exists so a human can read a report and act on it,
// and the RPC behind it checks is_moderator again, so rendering this screen to
// the wrong person shows them an empty list rather than anyone's data.
export default function ModerationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const isModerator = useIsModerator();
  const [includeResolved, setIncludeResolved] = useState(false);
  const { data: reports, isPending } = useReports(includeResolved);

  if (!isModerator) {
    return (
      <Screen className="justify-center gap-5">
        <Text variant="title">{t('moderation.title')}</Text>
        <Text tone="muted">{t('moderation.not_a_moderator')}</Text>
        <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen scroll className="gap-6 py-6">
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

      {isPending ? <Text tone="muted">{t('common.loading')}</Text> : null}

      {!isPending && (reports ?? []).length === 0 ? (
        <Card elevation="flat">
          <Text tone="muted">{t('moderation.empty')}</Text>
        </Card>
      ) : null}

      {(reports ?? []).map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}

      <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />
    </Screen>
  );
}
