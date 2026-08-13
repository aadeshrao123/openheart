import { ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Button } from './button';
import { cn } from '@/lib/cn';

// react-native-web's RefreshControl discards every prop including onRefresh and
// renders an empty View, so web has no pull gesture and gets a button instead.
//
// Everything else is identical to screen.tsx. A change there that is not about
// refreshing belongs here too.

type Width = keyof typeof widths;

const widths = {
  content: 'max-w-content',
  deck: 'max-w-deck',
  full: '',
} as const;

export type ScreenProps = ViewProps & {
  padded?: boolean;
  scroll?: boolean;
  width?: Width;
  refreshing?: boolean;
  onRefresh?: () => void;
  className?: string;
};

export function Screen({
  padded = true,
  scroll = false,
  width = 'content',
  refreshing = false,
  onRefresh,
  className,
  children,
  ...props
}: ScreenProps) {
  const { t } = useTranslation();

  const measure = cn('w-full self-center', widths[width], padded && 'px-6');
  const content = cn(measure, className);

  if (scroll) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
        <ScrollView
          className="flex-1"
          contentContainerClassName={cn('grow items-center')}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          <View className={cn('grow', content)}>
            {onRefresh ? (
              <Button
                variant="ghost"
                size="sm"
                label={t('common.refresh')}
                loading={refreshing}
                className="self-end"
                onPress={onRefresh}
              />
            ) : null}

            {children}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className={cn('flex-1', content)} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
