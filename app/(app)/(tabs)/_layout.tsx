import { Easing, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Tabs } from 'expo-router/js-tabs';
import type { BottomTabNavigationOptions } from 'expo-router/js-tabs';
import { TabBar, TAB_ROUTES } from '@/components/tab-bar';
import { isRtlLanguage } from '@/lib/i18n';
import { useReducedMotion } from '@/lib/use-reduced-motion';

// A full width slide, which the stack in this app deliberately does not have.
//
// screen-transitions.ts explains why: react-native-screens ships its Android
// animations as fixed XML with no anim-ldrtl variant, so a horizontal push
// cannot mirror for Arabic and Urdu and every stack here is vertical or a fade
// instead. That reasoning does not reach this file. A tab scene interpolator is
// a JavaScript Animated interpolation, so the direction is a number this
// function chooses and it can simply be negated.
//
// progress is already signed by the navigator: 0 for the focused scene, +1 for
// one further along the tab order and -1 for one behind it, which is read out
// of BottomTabView rather than assumed. So the scene to the right waits at
// +width and the one to the left at -width, and pressing a tab further along
// carries the incoming screen in from that side.
// Derived from the option rather than imported: the interpolator's own type is
// declared but not re-exported, and reaching into the build directory for it
// would break on any patch release.
type SceneInterpolator = NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']>;

const slide =
  (width: number, rtl: boolean): SceneInterpolator =>
  ({ current }) => {
    const distance = rtl ? -width : width;

    return {
      sceneStyle: {
        transform: [
          {
            translateX: current.progress.interpolate({
              inputRange: [-1, 0, 1],
              outputRange: [-distance, 0, distance],
            }),
          },
        ],
      },
    };
  };

// The shift preset's own spec is 150ms, which is tuned to its 50px nudge and
// reads as a snap across a whole screen width. Ease-out rather than ease-in-out
// because the incoming screen should arrive settled rather than decelerate into
// place from a standing start, which is the same argument screen-transitions.ts
// makes for its stack curve.
const SLIDE_SPEC = {
  animation: 'timing',
  config: { duration: 220, easing: Easing.out(Easing.cubic) },
} as const;

export default function TabsLayout() {
  const { i18n } = useTranslation();
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // From the active language rather than I18nManager, for the reason icon.tsx
  // records: react-native-web's I18nManager is a stub whose isRTL does not
  // exist, so it reads as undefined and nothing ever mirrors on web.
  const rtl = isRtlLanguage(i18n.language);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // The accessibility setting wins, same as every stack here. There is
        // nothing to time once the movement is gone.
        // 'none' is a real preset with a zero duration and no interpolator, so
        // leaving both of the next two undefined is genuinely still, not a
        // faster version of the same movement.
        animation: reduceMotion ? 'none' : 'shift',
        transitionSpec: reduceMotion ? undefined : SLIDE_SPEC,
        sceneStyleInterpolator: reduceMotion ? undefined : slide(width, rtl),
      }}
    >
      {TAB_ROUTES.map((name) => (
        <Tabs.Screen key={name} name={name} />
      ))}
    </Tabs>
  );
}
