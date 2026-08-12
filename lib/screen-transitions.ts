// Screen transitions, in one place, so a stack picks a meaning rather than an
// animation name.
//
// Two kinds, because a stack is doing one of two things:
//
// - 'step': the user is being carried through a fixed sequence. Sign in then
//   the code, or the three onboarding screens. There is a next and a previous.
// - 'switch': the user moved somewhere else with no fixed order. The root
//   stack swapping between the auth, onboarding and app groups, and the main
//   stack where home, deck, matches and settings are places rather than steps.
//
// What is deliberately not here is anything horizontal. The union below has
// slide_from_right, slide_from_left, ios_from_right and ios_from_left, and no
// logical start/end equivalent, and react-native-screens ships its Android
// animations in res/base/anim with no anim-ldrtl variant, so a right to left
// push stays right to left in Arabic and Urdu. Both languages ship. Vertical
// and opacity are the same in every writing direction, which is why every
// value used here is one of those.
//
// The animation names are the ones react-native-screens permits. The compiler
// is what holds this to them: these objects are spread into a Stack's
// screenOptions, so a value outside StackAnimationTypes fails the typecheck at
// the layout rather than at runtime.
export type ScreenTransitionKind = 'step' | 'switch';

export type ScreenTransition = {
  readonly animation: 'fade' | 'fade_from_bottom' | 'none';
  readonly animationDuration?: number;
};

// iOS only, and set so the two platforms take the same length of time. Android
// durations are fixed in the library's animation resources, iOS reads this
// prop and otherwise defaults to 500ms:
//
//   res/base/anim/rns_fade_in.xml         alpha, duration 150
//   res/base/anim/rns_fade_from_bottom.xml translate 8%, duration 350
//   ios/RNSScreenStackAnimator.mm          RNSDefaultTransitionDuration = 0.5
const FADE_MS = 150;
const RISE_MS = 350;

export function screenTransition(
  kind: ScreenTransitionKind,
  reduceMotion: boolean
): ScreenTransition {
  // The accessibility setting wins over every design intent below it. No
  // duration either: there is nothing left to time.
  if (reduceMotion) {
    return { animation: 'none' };
  }

  if (kind === 'step') {
    // 8% of the screen height upwards plus a fade, the same shape on both
    // platforms, and it reverses on the way back. That reads as one step of a
    // sequence without claiming a direction a translator would have to mirror.
    return { animation: 'fade_from_bottom', animationDuration: RISE_MS };
  }

  // A plain cross fade. It is the least movement of anything in the union
  // short of none, which is what the busiest stack in the app should use, and
  // it implies no ordering between two places that have none.
  return { animation: 'fade', animationDuration: FADE_MS };
}
