import { describe, expect, it } from 'vitest';
import { screenTransition, type ScreenTransitionKind } from './screen-transitions';

// Every kind, so a kind added later without a reduced motion answer fails here
// rather than shipping movement to someone who asked for none.
const KINDS: readonly ScreenTransitionKind[] = ['step', 'switch'];

describe('screenTransition with reduced motion on', () => {
  it('animates nothing, whatever the kind', () => {
    for (const kind of KINDS) {
      expect(screenTransition(kind, true).animation).toBe('none');
    }
  });

  it('leaves no duration to interpret', () => {
    for (const kind of KINDS) {
      expect(screenTransition(kind, true).animationDuration).toBeUndefined();
    }
  });
});

describe('screenTransition with reduced motion off', () => {
  it('gives every kind a real animation and a duration', () => {
    for (const kind of KINDS) {
      const transition = screenTransition(kind, false);

      expect(transition.animation).not.toBe('none');
      expect(transition.animationDuration).toBeGreaterThan(0);
    }
  });

  it('does not use the same transition for a step and a switch', () => {
    expect(screenTransition('step', false).animation).not.toBe(
      screenTransition('switch', false).animation
    );
  });

  // These two numbers are not taste. They are the durations react-native-screens
  // hardcodes in its Android animation resources, passed to iOS so a transition
  // does not take 150ms on one phone and 500ms on the other.
  it('matches the iOS duration to the fixed Android one', () => {
    expect(screenTransition('switch', false)).toEqual({
      animation: 'fade',
      animationDuration: 150,
    });
    expect(screenTransition('step', false)).toEqual({
      animation: 'fade_from_bottom',
      animationDuration: 350,
    });
  });
});
