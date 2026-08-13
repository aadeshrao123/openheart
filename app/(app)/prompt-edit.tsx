import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Chip, Screen, Section, Text, TextArea } from '@/components/ui';
import { usePrompts, useSavePrompts, type PromptAnswer } from '@/hooks/use-prompts';
import { useSession } from '@/hooks/use-session';
import { PROMPT_ANSWER_MAX, PROMPT_GROUPS, PROMPTS_MAX } from '@/lib/profile-options';

// Two states on one screen: pick a question, then write the answer. A third
// route between them would put a back button in the middle of one decision.
export default function PromptEditScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { slot } = useLocalSearchParams<{ slot: string }>();
  const { data: session } = useSession();
  const { data: answers } = usePrompts(session?.user.id);
  const savePrompts = useSavePrompts();

  const index = Math.min(Math.max(Number(slot) || 0, 0), PROMPTS_MAX - 1);
  const existing = answers?.[index] ?? null;

  const [prompt, setPrompt] = useState<string | null>(existing?.prompt ?? null);
  const [answer, setAnswer] = useState(existing?.answer ?? '');

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/prompts'));

  // Answered elsewhere, so it cannot be chosen twice. The one in this slot is
  // still offered, because reopening it is an edit rather than a duplicate.
  const taken = new Set(
    (answers ?? []).filter((_, at) => at !== index).map((entry) => entry.prompt),
  );

  const save = () => {
    if (prompt === null) {
      return;
    }

    const next: PromptAnswer[] = [...(answers ?? [])];
    next[index] = { prompt, answer: answer.trim(), position: index };

    savePrompts.mutate(
      next.filter((entry): entry is PromptAnswer => Boolean(entry)),
      { onSuccess: leave },
    );
  };

  if (prompt === null) {
    return (
      <Screen scroll className="gap-8 py-8">
        <View className="gap-2">
          <Text variant="title">{t('profile.prompt_choose')}</Text>
          <Text tone="muted">{t('profile.prompt_choose_hint')}</Text>
        </View>

        {PROMPT_GROUPS.map((group) => (
          <Section key={group.key} title={t(`profile.prompt_group_${group.key}`)}>
            <View className="gap-2">
              {group.prompts
                .filter((entry) => !taken.has(entry))
                .map((entry) => (
                  <Chip
                    key={entry}
                    label={t(`profile.prompt_${entry}`)}
                    className="w-full items-start"
                    onPress={() => setPrompt(entry)}
                  />
                ))}
            </View>
          </Section>
        ))}

        <Button variant="ghost" label={t('common.cancel')} onPress={leave} />
      </Screen>
    );
  }

  return (
    <Screen scroll className="gap-8 py-8">
      <Card elevation="flat" className="gap-3">
        <Text variant="overline" tone="accent">
          {t(`profile.prompt_${prompt}`)}
        </Text>

        <Button
          variant="ghost"
          size="sm"
          label={t('profile.prompt_change')}
          className="self-start"
          onPress={() => setPrompt(null)}
        />
      </Card>

      <View className="gap-2">
        <TextArea
          accessibilityLabel={t(`profile.prompt_${prompt}`)}
          value={answer}
          onChangeText={setAnswer}
          maxLength={PROMPT_ANSWER_MAX}
          placeholder={t('profile.prompt_placeholder')}
          className="min-h-32"
          autoFocus
        />

        <Text variant="caption" tone="subtle">
          {t('onboarding.bio_hint', { remaining: PROMPT_ANSWER_MAX - answer.length })}
        </Text>
      </View>

      <View className="gap-3">
        <Button
          label={t('common.save')}
          disabled={answer.trim().length === 0}
          loading={savePrompts.isPending}
          onPress={save}
        />

        <Button variant="ghost" label={t('common.cancel')} onPress={leave} />
      </View>

      {savePrompts.isError ? (
        <Text variant="caption" tone="danger" role="alert">
          {t('common.error_generic')}
        </Text>
      ) : null}
    </Screen>
  );
}
