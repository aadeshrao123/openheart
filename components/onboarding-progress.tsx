import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';

export const ONBOARDING_STEPS = 3;

export type OnboardingProgressProps = {
  step: number;
};

// The bars are decorative; the count is text, because "step 2 of 3" is the
// information and three unlabelled rectangles are not.
export function OnboardingProgress({ step }: OnboardingProgressProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-3">
      {/* aria-hidden, not accessibilityElementsHidden: react-native-web reads
          only aria-*, and React Native maps this one back to both native props
          itself. */}
      <View aria-hidden className="flex-row gap-2">
        {Array.from({ length: ONBOARDING_STEPS }, (_, index) => (
          <View
            key={index}
            className={cn(
              'h-1 flex-1 rounded-control',
              index < step ? 'bg-brand' : 'bg-border',
            )}
          />
        ))}
      </View>

      <Text variant="caption" tone="subtle">
        {t('onboarding.step', { step, total: ONBOARDING_STEPS })}
      </Text>
    </View>
  );
}
