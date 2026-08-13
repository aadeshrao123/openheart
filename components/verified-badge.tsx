import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from '@/components/ui';
import { cn } from '@/lib/cn';

export type VerifiedBadgeProps = {
  compact?: boolean;
  className?: string;
};

// Every candidate in the deck is verified, because discover_profiles requires
// photo_verified. Saying so is the point: the check is the thing that keeps the
// bots out, and it is worth nothing to the person looking if they cannot see it.
export function VerifiedBadge({ compact = false, className }: VerifiedBadgeProps) {
  const { t } = useTranslation();

  return (
    <View
      accessibilityLabel={t('profile.verified')}
      className={cn(
        'flex-row items-center gap-1.5 rounded-control bg-success/15 px-2.5 py-1',
        className,
      )}
    >
      <Icon name="shield" size="sm" className="text-success" />

      {compact ? null : (
        <Text variant="caption" font="emphasis" className="text-success">
          {t('profile.verified')}
        </Text>
      )}
    </View>
  );
}
