import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Card, Screen, Skeleton, Text } from '@/components/ui';
import { usePrompts, useSavePrompts } from '@/hooks/use-prompts';
import { useSession } from '@/hooks/use-session';
import { PROMPTS_MAX } from '@/lib/profile-options';

// Three slots. Choosing a question and writing an answer happen on their own
// screen, so this one stays a list of what has been answered.
export default function PromptsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const { data: answers, isPending } = usePrompts(session?.user.id);
  const savePrompts = useSavePrompts();

  if (isPending) {
    return (
      <Screen scroll className="gap-6 py-8">
        <View accessibilityRole="progressbar" aria-busy className="gap-6">
          <Skeleton shape="title" className="w-1/2" />
          <Skeleton shape="block" />
          <Skeleton shape="block" />
        </View>
      </Screen>
    );
  }

  const current = answers ?? [];
  const slots = Array.from({ length: PROMPTS_MAX }, (_, index) => current[index] ?? null);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/edit-profile'));

  const open = (slot: number) =>
    router.push({ pathname: '/prompt-edit', params: { slot: String(slot) } });

  const remove = (slot: number) =>
    savePrompts.mutate(current.filter((_, index) => index !== slot));

  return (
    <Screen scroll className="gap-8 py-8">
      <View className="gap-2">
        <Text variant="title">{t('profile.section_prompts')}</Text>
        <Text tone="muted">{t('profile.prompts_hint')}</Text>
      </View>

      <View className="gap-4">
        {slots.map((slot, index) => (
          <Card key={index} elevation={slot ? 'raised' : 'flat'} className="gap-3">
            {slot === null ? (
              <Button
                variant="secondary"
                label={t('profile.prompt_add')}
                onPress={() => open(index)}
              />
            ) : (
              <>
                <Text variant="overline" tone="accent">
                  {t(`profile.prompt_${slot.prompt}`)}
                </Text>

                <Text variant="quote">{slot.answer}</Text>

                <View className="flex-row gap-3 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    label={t('common.edit')}
                    className="flex-1"
                    onPress={() => open(index)}
                  />

                  <Button
                    variant="danger"
                    size="sm"
                    label={t('common.remove')}
                    className="flex-1"
                    loading={savePrompts.isPending}
                    onPress={() => remove(index)}
                  />
                </View>
              </>
            )}
          </Card>
        ))}
      </View>

      <Button variant="ghost" label={t('common.back')} onPress={leave} />

      {savePrompts.isError ? (
        <Text variant="caption" tone="danger" role="alert">
          {t('common.error_generic')}
        </Text>
      ) : null}
    </Screen>
  );
}
