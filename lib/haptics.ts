import * as Haptics from 'expo-haptics';

// Nothing in here returns a promise, and that is the whole design: a haptic is
// an aside to an action, never a step in it. Awaiting one would put a vibration
// motor on the path of a swipe, which is the same mistake as waiting on an
// animation callback.
//
// Failures are swallowed rather than reported. A phone with no taptic engine, a
// browser tab, a user who has vibration switched off in system settings: all
// ordinary, none of them worth an error per swipe, and none of them a reason a
// flow should stop.
//
// The rejection is real and not defensive. On native ExpoHaptics is
// requireOptionalNativeModule('ExpoHaptics') (node_modules/expo-haptics/src/
// ExpoHaptics.ts), which is null in any build made before this dependency was
// added, and every entry point in Haptics.ts then does
// `throw new UnavailabilityError(...)` from inside an async function, so it
// arrives as a rejected promise. Without the catch that reaches the root error
// boundary and takes a screen down over a vibration.
function fire(feedback: () => Promise<void>): void {
  try {
    void feedback().catch(() => {
      // Expected on any device or browser that cannot do this.
    });
  } catch {
    // Unreachable while the module's entry points are async functions, which
    // they are in 57.0.1. One line to stay unreachable if that ever changes.
  }
}

// Named for the moment, never for the effect. A call site that said
// ImpactFeedbackStyle.Light would have to be re-argued every time the feel of
// the app was tuned, and the argument belongs here, in one file, next to the
// other two.
//
// Three moments is the entire list on purpose. Buzzing on routine taps is how
// an app trains people to turn haptics off, and the ones that matter go with
// them.
export const haptics = {
  // The card has committed and is gone. Light because this is the one that
  // fires dozens of times in a sitting, and it stands in for the weight of the
  // card leaving the thumb, not for the importance of the decision.
  //
  // Deliberately only on commit. A haptic that tracked the drag would fire on
  // every frame of a gesture.
  swipeCommitted(): void {
    fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },

  // The one unambiguously good thing that happens in this app, and the only
  // place a celebratory pattern is honest.
  matchMade(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },

  // Warning rather than Error: blocking someone is a thing that worked, and it
  // is the user's own decision. Error is for something that went wrong, and
  // this is the safety control doing exactly what it was asked to.
  destructiveConfirmed(): void {
    fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
};
