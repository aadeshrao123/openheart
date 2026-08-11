import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/cn';

type Elevation = keyof typeof elevations;

const elevations = {
  flat: 'bg-surface',
  raised: 'bg-surface-raised border border-border shadow-sm shadow-shadow/5',
} as const;

export type CardProps = ViewProps & {
  elevation?: Elevation;
  className?: string;
};

export function Card({ elevation = 'raised', className, ...props }: CardProps) {
  return (
    <View
      className={cn('rounded-card p-5', elevations[elevation], className)}
      {...props}
    />
  );
}
