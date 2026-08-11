import { forwardRef, useImperativeHandle } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components/ui';
import { cn } from '@/lib/cn';
import { ProfileCard } from '@/components/profile-card';
import type { Candidate, SwipeDirection } from '@/hooks/use-discovery';

// Past this much horizontal travel the card commits rather than springing back.
const COMMIT_DISTANCE = 110;

// A quick flick should commit even if it never travelled far.
const COMMIT_VELOCITY = 700;

const MAX_ROTATION_DEGREES = 12;

// Three is enough to read as a stack. Rendering the rest would build twenty
// cards nobody can see yet.
const VISIBLE_CARDS = 3;

export type SwipeDeckHandle = {
  swipe: (direction: SwipeDirection) => void;
};

export type SwipeDeckProps = {
  candidates: Candidate[];
  onSwipe: (candidate: Candidate, direction: SwipeDirection) => void;
  onOpen: (candidate: Candidate) => void;
};

export const SwipeDeck = forwardRef<SwipeDeckHandle, SwipeDeckProps>(function SwipeDeck(
  { candidates, onSwipe, onOpen },
  ref,
) {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const visible = candidates.slice(0, VISIBLE_CARDS);
  const top = visible[0];

  // The swipe is recorded the moment it is decided, never when an animation
  // finishes. Reanimated honours prefers-reduced-motion by not animating at
  // all, and requestAnimationFrame stalls in a background tab, so a completion
  // callback is not something a core action can depend on: it would leave a
  // Like button that silently does nothing for exactly the users least able to
  // work around it.
  //
  // Resetting here rather than in an effect means the offset is cleared in the
  // same commit that removes the card, so the next profile is never drawn at
  // the old position.
  const commit = (direction: SwipeDirection) => {
    if (!top) {
      return;
    }

    translateX.set(0);
    translateY.set(0);

    onSwipe(top, direction);
  };

  // Buttons take the same path a released gesture does. This is the accessible
  // route: a deck that can only be driven by dragging cannot be operated by a
  // screen reader at all, so the buttons are not a fallback.
  useImperativeHandle(ref, () => ({ swipe: commit }));

  const pan = Gesture.Pan()
    .onChange((event) => {
      translateX.set(translateX.get() + event.changeX);
      translateY.set(translateY.get() + event.changeY);
    })
    .onEnd((event) => {
      const offset = translateX.get();
      const travelled = Math.abs(offset) > COMMIT_DISTANCE;
      const flicked = Math.abs(event.velocityX) > COMMIT_VELOCITY;

      if (!travelled && !flicked) {
        // Decorative, and safe to lose under reduced motion: the card is
        // already where the finger left it and nothing depends on this.
        translateX.set(withSpring(0));
        translateY.set(withSpring(0));
        return;
      }

      // The card is already most of the way off under the user's thumb, so
      // removing it now reads as the swipe completing rather than as a jump.
      runOnJS(commit)(offset > 0 ? 'like' : 'pass');
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      // Transforms are not mirrored by I18nManager, so a right swipe stays a
      // right swipe under RTL rather than quietly inverting like and pass.
      {
        rotate: `${interpolate(
          translateX.get(),
          [-width, 0, width],
          [-MAX_ROTATION_DEGREES, 0, MAX_ROTATION_DEGREES],
        )}deg`,
      },
    ],
  }));

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [0, COMMIT_DISTANCE], [0, 1], 'clamp'),
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.get(), [-COMMIT_DISTANCE, 0], [1, 0], 'clamp'),
  }));

  return (
    <View className="flex-1">
      {/* Reversed so the first candidate paints last and sits on top, without
          needing a z-index per card. */}
      {visible
        .map((candidate, index) => ({ candidate, index }))
        .reverse()
        .map(({ candidate, index }) =>
          index === 0 ? (
            <GestureDetector key={candidate.id} gesture={pan}>
              <Animated.View style={[{ position: 'absolute', inset: 0 }, cardStyle]}>
                <ProfileCard candidate={candidate} onPress={() => onOpen(candidate)} />

                {/* left and right rather than start and end, and deliberately
                    so. These label a physical drag direction, and transforms
                    are not mirrored by I18nManager, so the card still leaves to
                    the right under RTL. Flipping these would put "Like" on the
                    side that means pass. Everything that is reading order
                    rather than drag direction uses the logical properties.

                    Hidden from assistive technology: they preview what
                    releasing would do and the buttons already say it.
                    aria-hidden as well as the native props, because
                    react-native-web reads only the aria-* form and would
                    otherwise announce "Pass Like" over every card. */}
                <Animated.View
                  style={[{ position: 'absolute', top: 24, left: 24 }, passStyle]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                >
                  <Badge label={t('deck.pass')} tone="danger" />
                </Animated.View>

                <Animated.View
                  style={[{ position: 'absolute', top: 24, right: 24 }, likeStyle]}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  aria-hidden
                >
                  <Badge label={t('deck.like')} tone="success" />
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          ) : (
            // Behind the top card and inert. Hidden from assistive technology so
            // a screen reader reads one profile rather than three.
            <View
              key={candidate.id}
              style={{ position: 'absolute', inset: 0, transform: [{ scale: 1 - index * 0.04 }] }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              aria-hidden
            >
              <ProfileCard candidate={candidate} />
            </View>
          ),
        )}
    </View>
  );
});

type BadgeProps = {
  label: string;
  tone: 'success' | 'danger';
};

function Badge({ label, tone }: BadgeProps) {
  return (
    <View
      className={cn(
        'rounded-control border-2 px-4 py-1.5',
        tone === 'success' ? 'border-success bg-bg/80' : 'border-danger bg-bg/80',
      )}
    >
      <Text variant="overline" tone={tone === 'success' ? 'default' : 'danger'}>
        {label}
      </Text>
    </View>
  );
}
