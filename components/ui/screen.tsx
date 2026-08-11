import { RefreshControl, ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/cn';

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

// className always styles the content, scrolling or not, so a screen can move
// between the two without rewriting its layout classes.
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
          // Given no colours on purpose. tintColor and colors are JavaScript
          // props, so setting them would put a value outside global.css, which
          // is the same reason this project has no slider. The platform default
          // spinner is the honest trade.
          //
          // Native only, and not by choice: react-native-web's RefreshControl
          // discards every prop including onRefresh and renders a bare View, so
          // there is no pull gesture on web at all. It is a no-op there rather
          // than a crash, which is the requirement, but web still has no way to
          // refresh by hand.
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            ) : undefined
          }
        >
          <View className={cn('grow', content)}>{children}</View>
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
