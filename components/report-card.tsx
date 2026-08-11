import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Card, Rail, Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDate, formatTime } from '@/lib/format';
import { useLiftSuspension, useResolveReport, type Report } from '@/hooks/use-moderation';

type Evidence = { sender_id: string; body: string; created_at: string };

// The reporter chose to submit this. It is the only conversation content a
// moderator can see anywhere in the product.
function readEvidence(raw: Report['evidence']): Evidence[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.filter(
    (entry): entry is Evidence =>
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as Evidence).body === 'string' &&
      typeof (entry as Evidence).sender_id === 'string',
  );
}

export type ReportCardProps = {
  report: Report;
};

export function ReportCard({ report }: ReportCardProps) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const resolve = useResolveReport();
  const lift = useLiftSuspension();

  const evidence = readEvidence(report.evidence);
  const open = report.status === 'pending';

  return (
    <Card className="gap-4">
      <View className="gap-1">
        <Text variant="overline" tone="brand">
          {t(`safety.reason_${report.reason}`, { defaultValue: report.reason })}
        </Text>

        <Text variant="heading">{report.target_name}</Text>

        <Text variant="caption" tone="subtle">
          {t('moderation.filed_at', {
            date: formatDate(new Date(report.created_at)),
            time: formatTime(new Date(report.created_at)),
          })}
        </Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <Text variant="caption" tone={report.target_reports > 1 ? 'danger' : 'muted'}>
          {t('moderation.report_count', { count: report.target_reports })}
        </Text>

        {report.target_suspended ? (
          <Text variant="caption" tone="danger">
            {t('moderation.already_suspended')}
          </Text>
        ) : null}
      </View>

      {report.detail ? (
        <Rail tone="accent" className="ps-4">
          <Text>{report.detail}</Text>
        </Rail>
      ) : null}

      {evidence.length > 0 ? (
        <View className="gap-2 rounded-card bg-surface p-3">
          <Text variant="overline" tone="subtle">
            {t('moderation.evidence_title', { count: evidence.length })}
          </Text>

          {evidence.map((entry) => (
            <Text
              key={`${entry.created_at}-${entry.body}`}
              variant="caption"
              tone={entry.sender_id === report.target_id ? 'default' : 'subtle'}
            >
              {t('moderation.evidence_line', {
                who:
                  entry.sender_id === report.target_id
                    ? report.target_name
                    : t('moderation.reporter'),
                body: entry.body,
              })}
            </Text>
          ))}
        </View>
      ) : null}

      {open ? (
        <>
          <TextInput
            multiline
            value={note}
            onChangeText={setNote}
            maxLength={1000}
            placeholder={t('moderation.note_placeholder')}
            accessibilityLabel={t('moderation.note_placeholder')}
            className={cn(
              'h-20 rounded-control border border-border bg-surface px-4 py-3',
              'text-body font-body text-fg',
              'placeholder:text-fg-subtle selection:bg-brand-subtle',
            )}
          />

          <View className="gap-2">
            <Button
              variant="danger"
              size="sm"
              label={t('moderation.action_suspend')}
              loading={resolve.isPending}
              onPress={() =>
                resolve.mutate({
                  reportId: report.id,
                  verdict: 'actioned',
                  note,
                  suspend: true,
                })
              }
            />

            <Button
              variant="secondary"
              size="sm"
              label={t('moderation.action_reviewed')}
              loading={resolve.isPending}
              onPress={() =>
                resolve.mutate({ reportId: report.id, verdict: 'reviewed', note })
              }
            />

            <Button
              variant="ghost"
              size="sm"
              label={t('moderation.action_dismiss')}
              loading={resolve.isPending}
              onPress={() =>
                resolve.mutate({ reportId: report.id, verdict: 'dismissed', note })
              }
            />
          </View>
        </>
      ) : (
        <View className="gap-2">
          <Text variant="caption" tone="muted">
            {t(`moderation.status_${report.status}`, { defaultValue: report.status })}
          </Text>

          {report.moderator_note ? (
            <Text variant="caption" tone="subtle">
              {report.moderator_note}
            </Text>
          ) : null}

          {report.target_suspended ? (
            <Button
              variant="ghost"
              size="sm"
              label={t('moderation.action_lift')}
              loading={lift.isPending}
              onPress={() => lift.mutate(report.target_id)}
            />
          ) : null}
        </View>
      )}

      {resolve.isError ? (
        <Text variant="caption" tone="danger">
          {t('common.error_generic')}
        </Text>
      ) : null}
    </Card>
  );
}
