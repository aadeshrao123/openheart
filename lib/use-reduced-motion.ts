import { useSyncExternalStore } from 'react';
import { AccessibilityInfo } from 'react-native';

// Whether the device asked for less movement. One module level store rather
// than a subscription per component, for a reason that is visible in the
// installed web source:
//
//   handlers[handler] = listener;
//   ...
//   var listener = handlers[handler];
//
// in node_modules/react-native-web/dist/exports/AccessibilityInfo/index.js.
// That index is the handler function coerced to a string, so two components
// subscribing with closures that happen to have the same body share one entry,
// and the first one to unsubscribe removes the other one's listener. Keeping
// exactly one handler for the lifetime of the app is what makes that
// impossible. It is never removed because the setting outlives every screen.
//
// The web side is real, not a stub. Same file:
//
//   var prefersReducedMotionMedia = canUseDOM && typeof window.matchMedia === 'function'
//     ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
//
// and reduceMotionChanged is wired to that media query's change event, so a
// .web.ts variant here would only be reimplementing what is already there.
// I18nManager and RefreshControl are the stubs in this package; this one is not.

// True until something says otherwise, which is the direction that cannot hurt
// anyone: a user who asked for no movement never sees a transition slip
// through while the query is in flight, and a user who did not ask loses at
// most the first transition after launch. react-native-web resolves the same
// way when it cannot tell (isReduceMotionEnabled resolves true when there is
// no matchMedia, during the static export for instance).
let reduceMotion = true;
let subscribed = false;

const listeners = new Set<() => void>();

function setReduceMotion(next: boolean): void {
  if (next === reduceMotion) {
    return;
  }

  reduceMotion = next;

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  if (!subscribed) {
    subscribed = true;

    // A rejection leaves the value where it started, which is no animation. An
    // app that cannot read the setting is not an app that should guess at it.
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion, () => {});

    // The setting changes while the app is running. On iOS it is one switch in
    // Settings, and a user who reaches for it mid session is telling us
    // something about right now, not about the next cold start.
    AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
  }

  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  return reduceMotion;
}

// getSnapshot serves the static export too: subscribe only runs in an effect,
// so the exported HTML is rendered with the initial value and the browser
// reaches the same one before hydration compares them.
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
