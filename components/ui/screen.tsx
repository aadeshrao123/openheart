import { ScrollView, View, type ViewProps } from 'react-native';
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
  className?: string;
};

// className always styles the content, scrolling or not, so a screen can move
// between the two without rewriting its layout classes.
export function Screen({
  padded = true,
  scroll = false,
  width = 'content',
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
