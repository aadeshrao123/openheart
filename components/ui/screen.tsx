import { ScrollView, View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/cn';

export type ScreenProps = ViewProps & {
  padded?: boolean;
  scroll?: boolean;
  className?: string;
};

// className always styles the content, scrolling or not, so a caller can move a
// screen between the two without rewriting its layout classes.
export function Screen({
  padded = true,
  scroll = false,
  className,
  children,
  ...props
}: ScreenProps) {
  const content = cn(padded && 'px-4', className);

  if (scroll) {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
        <ScrollView
          className="flex-1"
          // grow, not flex-1: the content stretches to fill a short page so
          // justify-* still works, but is free to exceed the viewport on a
          // small screen instead of being clipped.
          contentContainerClassName={cn('grow', content)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
        >
          {children}
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
