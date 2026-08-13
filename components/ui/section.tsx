import { View, type ViewProps } from 'react-native';
import { Text } from './text';
import { cn } from '@/lib/cn';

export type SectionProps = ViewProps & {
  title: string;
  description?: string;
  className?: string;
};

// A titled group. Screens were flat stacks of controls with no hierarchy, so
// everything looked equally important and nothing was scannable.
export function Section({ title, description, className, children, ...props }: SectionProps) {
  return (
    <View className={cn('gap-4', className)} {...props}>
      <View className="gap-1.5">
        <Text variant="heading">{title}</Text>

        {description ? (
          <Text variant="caption" tone="subtle">
            {description}
          </Text>
        ) : null}
      </View>

      {children}
    </View>
  );
}
