import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button, Rail, Text } from '@/components/ui';
import { useConsentMove, useConsentStatus } from '@/hooks/use-chat-consent';

export type ChatConsentProps = {
  matchId: string;
  name: string;
};

// Above the composer, because it is about what may be typed into it. Only ever
// one of the three, so the conversation is never buried under a stack of
// notices about itself.
export function ConsentBanner({ matchId, name }: ChatConsentProps) {
  const { t } = useTranslation();
  const { awaitingMe, awaitingThem, explicitAllowed } = useConsentStatus(matchId);
  const move = useConsentMove(matchId);

  if (awaitingMe) {
    return (
      <Rail tone="accent" className="mx-4 mb-2 gap-3">
        <Text variant="label">{t('consent.asked_title', { name })}</Text>
        <Text variant="caption" tone="muted">
          {t('consent.asked_body')}
        </Text>

        <View className="flex-row gap-2">
          {/* Declining is not the quiet option and not the loud one. A refusal
              styled as the safe choice implies agreeing is the risky one, and
              this is a decision between two adults, not a warning. */}
          <Button
            size="sm"
            className="flex-1"
            label={t('consent.accept')}
            loading={move.isPending}
            onPress={() => move.mutate({ kind: 'respond', accept: true })}
          />

          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            label={t('consent.decline')}
            loading={move.isPending}
            onPress={() => move.mutate({ kind: 'respond', accept: false })}
          />
        </View>

        {move.isError ? (
          <Text variant="caption" tone="danger" role="alert">
            {t('common.error_generic')}
          </Text>
        ) : null}
      </Rail>
    );
  }

  if (awaitingThem) {
    return (
      <View className="mx-4 mb-2">
        <Text variant="caption" tone="subtle">
          {t('consent.waiting', { name })}
        </Text>
      </View>
    );
  }

  if (explicitAllowed) {
    return (
      <View className="mx-4 mb-2 flex-row items-center gap-3">
        <Text variant="caption" tone="subtle" className="flex-1">
          {t('consent.active_short')}
        </Text>

        {/* Reachable from the conversation, not two screens away. Withdrawing
            consent has to be as easy as the message that made you want to. */}
        <Button
          variant="ghost"
          size="sm"
          label={t('consent.turn_back_on')}
          loading={move.isPending}
          onPress={() => move.mutate({ kind: 'revoke' })}
        />
      </View>
    );
  }

  return null;
}

// The other half, on the manage screen, where unmatching and hiding already
// live. Asking is a considered thing rather than something to trip over next to
// the send button.
export function ConsentControl({ matchId, name }: ChatConsentProps) {
  const { t } = useTranslation();
  const { state, explicitAllowed, awaitingMe, awaitingThem, canRequest } =
    useConsentStatus(matchId);

  const move = useConsentMove(matchId);

  return (
    <View className="gap-2">
      <Text variant="overline" tone="subtle">
        {t('consent.title')}
      </Text>

      {explicitAllowed ? (
        <>
          <Button
            variant="secondary"
            size="sm"
            label={t('consent.turn_back_on')}
            loading={move.isPending}
            onPress={() => move.mutate({ kind: 'revoke' })}
          />

          <Text variant="caption" tone="subtle">
            {t('consent.active_explainer')}
          </Text>
        </>
      ) : awaitingThem ? (
        <>
          <Text variant="caption" tone="subtle">
            {t('consent.waiting', { name })}
          </Text>

          {/* Taking the question back before it is answered. Nobody refused
              anything, so this leaves it open to either of you. */}
          <Button
            variant="ghost"
            size="sm"
            label={t('consent.withdraw')}
            loading={move.isPending}
            onPress={() => move.mutate({ kind: 'revoke' })}
          />
        </>
      ) : awaitingMe ? (
        // Answerable in the conversation and nowhere else. A yes given on a
        // settings screen is a yes given away from what was actually said.
        <Text variant="caption" tone="subtle">
          {t('consent.answer_in_chat', { name })}
        </Text>
      ) : canRequest ? (
        <>
          <Button
            variant="ghost"
            size="sm"
            label={t('consent.ask')}
            loading={move.isPending}
            onPress={() => move.mutate({ kind: 'request' })}
          />

          <Text variant="caption" tone="subtle">
            {t('consent.ask_explainer', { name })}
          </Text>
        </>
      ) : (
        // They declined or they withdrew. No button, because whether it is
        // asked again is theirs to decide and an ask button here is the whole
        // nagging problem in one tap.
        <Text variant="caption" tone="subtle">
          {t(state === 'declined' ? 'consent.declined_by_them' : 'consent.revoked_by_them', {
            name,
          })}
        </Text>
      )}

      {move.isError ? (
        <Text variant="caption" tone="danger" role="alert">
          {t('common.error_generic')}
        </Text>
      ) : null}
    </View>
  );
}
