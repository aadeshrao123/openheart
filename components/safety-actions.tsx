import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Chip, Text, TextArea } from '@/components/ui';
import { RATE_LIMITED } from '@/lib/db-errors';
import { haptics } from '@/lib/haptics';
import { REPORT_REASONS, type ReportReason } from '@/lib/report-reasons';
import { useBlock, useReport } from '@/hooks/use-safety';

type Stage = 'menu' | 'report' | 'block' | 'done';

export type SafetyActionsProps = {
  visible: boolean;
  name: string;
  targetId: string;
  matchId?: string;
  evidence?: { sender_id: string; body: string; created_at: string }[];
  onClose: () => void;
  onBlocked?: () => void;
};

export function SafetyActions({
  visible,
  name,
  targetId,
  matchId,
  evidence,
  onClose,
  onBlocked,
}: SafetyActionsProps) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('menu');
  const [reason, setReason] = useState<ReportReason>('harassment');
  const [detail, setDetail] = useState('');

  const report = useReport();
  const block = useBlock();

  const close = () => {
    setStage('menu');
    setDetail('');
    report.reset();
    block.reset();
    onClose();
  };

  const submitReport = () => {
    report.mutate(
      { targetId, reason, detail, matchId, evidence },
      { onSuccess: () => setStage('done') },
    );
  };

  const reportError = () => {
    if (!report.isError) {
      return undefined;
    }

    return report.error.message === RATE_LIMITED
      ? t('safety.report_rate_limited')
      : t('common.error_generic');
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View className="flex-1 items-center justify-end p-4">
        <Pressable
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          className="absolute inset-0 bg-shadow/50"
        />

        <View
          accessibilityViewIsModal
          aria-modal
          className="w-full max-w-content gap-4 rounded-card bg-surface-raised p-5"
        >
          {stage === 'menu' ? (
            <>
              <Text variant="overline" tone="subtle">
                {t('safety.title', { name })}
              </Text>

              <Button
                variant="secondary"
                label={t('safety.report')}
                onPress={() => setStage('report')}
              />

              <Button
                variant="danger"
                label={t('safety.block')}
                onPress={() => setStage('block')}
              />

              <Text variant="caption" tone="subtle">
                {t('safety.menu_explainer')}
              </Text>
            </>
          ) : null}

          {stage === 'report' ? (
            <>
              <Text variant="overline" tone="subtle">
                {t('safety.report_title')}
              </Text>

              <View accessibilityRole="radiogroup" className="flex-row flex-wrap gap-2">
                {REPORT_REASONS.map((code) => (
                  <Chip
                    key={code}
                    mode="radio"
                    label={t(`safety.reason_${code}`)}
                    selected={reason === code}
                    onPress={() => setReason(code)}
                  />
                ))}
              </View>

              <View className="gap-2">
                <Text variant="overline" tone="subtle">
                  {t('safety.detail_label')}
                </Text>

                <TextArea
                  value={detail}
                  onChangeText={setDetail}
                  maxLength={1000}
                  placeholder={t('safety.detail_placeholder')}
                  accessibilityLabel={t('safety.detail_label')}
                  // Recessed, because this one sits inside a raised surface.
                  className="h-24 bg-surface"
                />
              </View>

              {evidence && evidence.length > 0 ? (
                <Text variant="caption" tone="subtle">
                  {t('safety.evidence_note', { count: evidence.length })}
                </Text>
              ) : null}

              {reportError() ? (
                <Text variant="caption" tone="danger">
                  {reportError()}
                </Text>
              ) : null}

              <Button
                label={t('safety.report_submit')}
                loading={report.isPending}
                onPress={submitReport}
              />

              <Button variant="ghost" label={t('common.cancel')} onPress={close} />
            </>
          ) : null}

          {stage === 'block' ? (
            <>
              <Text variant="overline" tone="subtle">
                {t('safety.block')}
              </Text>

              <Text tone="muted">{t('safety.block_confirm', { name })}</Text>

              <Text variant="caption" tone="subtle">
                {t('safety.block_explainer')}
              </Text>

              {block.isError ? (
                <Text variant="caption" tone="danger">
                  {t('common.error_generic')}
                </Text>
              ) : null}

              <Button
                variant="danger"
                label={t('safety.block_action', { name })}
                loading={block.isPending}
                onPress={() =>
                  block.mutate(targetId, {
                    // On success and not on the press. The modal closing is the
                    // only confirmation a block gives, by design, and a buzz on
                    // the press would be that confirmation arriving before the
                    // write has landed. A safety control is the last place to
                    // say a thing happened before it did.
                    onSuccess: () => {
                      haptics.destructiveConfirmed();
                      close();
                      onBlocked?.();
                    },
                  })
                }
              />

              <Button variant="ghost" label={t('common.cancel')} onPress={close} />
            </>
          ) : null}

          {stage === 'done' ? (
            <>
              <Text variant="overline" tone="accent">
                {t('safety.report_submitted')}
              </Text>

              <Text tone="muted">{t('safety.report_done_body')}</Text>

              <Button label={t('common.continue')} onPress={close} />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
