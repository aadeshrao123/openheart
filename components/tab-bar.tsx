import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Icon, Text, type IconProps } from '@/components/ui';
import { cn } from '@/lib/cn';

// The route name each tab renders, in the order they appear. The order is the
// contract the slide direction depends on: pressing a tab further along moves
// the scene one way, further back the other, and that is read from these
// indices rather than from anything the tab bar draws.
export const TAB_ROUTES = ['deck', 'likes', 'matches', 'home'] as const;

const TABS: Record<string, { icon: IconProps['name']; label: string }> = {
  deck: { icon: 'cards', label: 'tabs.browse' },
  likes: { icon: 'heart', label: 'tabs.likes' },
  matches: { icon: 'chat', label: 'tabs.messages' },
  home: { icon: 'person', label: 'tabs.profile' },
};

// A custom bar rather than the built-in one, which takes its colours as
// JavaScript props: tabBarActiveTintColor is a colour outside global.css and
// would be the same defect as a hex code in a component.
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View
      // The inset rather than a Screen edge, because the bar is what actually
      // sits against the home indicator now.
      style={{ paddingBottom: insets.bottom }}
      className="flex-row border-t border-border bg-surface"
    >
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];

        if (!tab) {
          return null;
        }

        const focused = state.index === index;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            // selected, not a label suffix. A screen reader announces the state
            // itself, and appending "selected" to the name says it twice.
            aria-selected={focused}
            accessibilityLabel={t(tab.label)}
            onPress={() => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            }}
            className={cn(
              'min-h-14 flex-1 items-center justify-center gap-1 py-2',
              'hover:bg-surface-hover active:bg-surface-pressed',
            )}
          >
            <Icon
              name={tab.icon}
              size="lg"
              filled={focused && tab.icon === 'heart'}
              className={focused ? 'text-brand' : 'text-fg-subtle'}
            />

            <Text
              variant="caption"
              font={focused ? 'strong' : 'body'}
              className={focused ? 'text-brand' : 'text-fg-subtle'}
            >
              {t(tab.label)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
