import { View, type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cn } from '@/lib/cn';

export type ScreenProps = ViewProps & {
  padded?: boolean;
  className?: string;
};

export function Screen({
  padded = true,
  className,
  children,
  ...props
}: ScreenProps) {
  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className={cn('flex-1', padded && 'px-4', className)} {...props}>
        {children}
      </View>
    </SafeAreaView>
  );
}
