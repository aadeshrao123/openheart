import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, type IconProps } from './icon';
import { Text } from './text';
import { cn } from '@/lib/cn';

export type EmptyStateProps = {
  icon: IconProps['name'];
  title?: string;
  body: string;
  // Whatever the user should do next. Omitted where there is nothing to do,
  // which is most of the moderation queues.
  children?: ReactNode;
  className?: string;
};

// Seven screens said nothing but one grey sentence when they had no rows, which
// is the texture that makes an app feel like a form. An empty screen is still a
// screen and it is often the first one somebody sees.
//
// The disc is brand-subtle rather than brand: an empty state is not an alert,
// and a saturated circle on an otherwise blank screen reads as one.
export function EmptyState({ icon, title, body, children, className }: EmptyStateProps) {
  return (
    <View className={cn('items-center gap-5 px-4 py-10', className)}>
      <View className="h-20 w-20 items-center justify-center rounded-full bg-brand-subtle">
        <Icon name={icon} size="lg" className="text-brand" />
      </View>

      <View className="items-center gap-2">
        {title ? <Text variant="heading">{title}</Text> : null}

        <Text tone="muted" className="text-center">
          {body}
        </Text>
      </View>

      {children ? <View className="w-full gap-3">{children}</View> : null}
    </View>
  );
}
