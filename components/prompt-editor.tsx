import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Chip, Text, TextArea } from '@/components/ui';
import { PROMPTS, PROMPTS_MAX, PROMPT_ANSWER_MAX } from '@/lib/profile-options';
import type { PromptAnswer } from '@/hooks/use-prompts';

export type PromptEditorProps = {
  value: PromptAnswer[];
  onChange: (answers: PromptAnswer[]) => void;
};

// Three slots. A slot with no question chosen shows the whole list; once one is
// chosen it collapses to that chip plus a text area, so the screen is not a
// wall of forty options three times over.
export function PromptEditor({ value, onChange }: PromptEditorProps) {
  const { t } = useTranslation();

  const slots = Array.from({ length: PROMPTS_MAX }, (_, index) => value[index] ?? null);
  const taken = new Set(value.map((entry) => entry.prompt));

  const write = (index: number, next: PromptAnswer | null) => {
    const kept = slots.map((slot, at) => (at === index ? next : slot));

    onChange(kept.filter((slot): slot is PromptAnswer => slot !== null));
  };

  return (
    <View className="gap-4">
      {slots.map((slot, index) => (
        <Card key={index} elevation="flat" className="gap-3">
          {slot === null ? (
            <>
              <Text variant="label" tone="muted">
                {t('profile.prompt_choose')}
              </Text>

              <View className="flex-row flex-wrap gap-2">
                {PROMPTS.filter((prompt) => !taken.has(prompt)).map((prompt) => (
                  <Chip
                    key={prompt}
                    label={t(`profile.prompt_${prompt}`)}
                    onPress={() => write(index, { prompt, answer: '', position: index })}
                  />
                ))}
              </View>
            </>
          ) : (
            <>
              <View className="flex-row items-start justify-between gap-3">
                <Text variant="label" className="flex-1">
                  {t(`profile.prompt_${slot.prompt}`)}
                </Text>

                <Chip
                  label={t('common.cancel')}
                  onPress={() => write(index, null)}
                  className="min-h-0 px-3 py-1"
                />
              </View>

              <TextArea
                accessibilityLabel={t(`profile.prompt_${slot.prompt}`)}
                value={slot.answer}
                onChangeText={(answer) => write(index, { ...slot, answer })}
                maxLength={PROMPT_ANSWER_MAX}
                placeholder={t('profile.prompt_placeholder')}
                className="min-h-20"
              />
            </>
          )}
        </Card>
      ))}
    </View>
  );
}
