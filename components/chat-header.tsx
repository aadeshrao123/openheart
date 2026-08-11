import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Avatar, Icon, Text } from '@/components/ui';

export type ChatHeaderProps = {
  name: string;
  photoKey: string | null;
  subtitle: string;
  onBack: () => void;
  onOpenProfile: () => void;
};

export function ChatHeader({ name, photoKey, subtitle, onBack, onOpenProfile }: ChatHeaderProps) {
  const { t } = useTranslation();

  return (
    <View className="flex-row items-center gap-1 border-b border-border pb-3">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        className="h-11 w-11 items-center justify-center"
      >
        <Icon name="chevron" size="lg" className="text-fg" />
      </Pressable>

      <Pressable
        onPress={onOpenProfile}
        accessibilityRole="button"
        accessibilityLabel={t('chat.open_profile', { name })}
        className="flex-1 flex-row items-center gap-3 py-1"
      >
        <Avatar name={name} photoKey={photoKey} size="md" />

        <View className="shrink">
          <Text variant="heading" numberOfLines={1}>
            {name}
          </Text>
          <Text variant="caption" tone="subtle" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
