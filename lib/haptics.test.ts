import { beforeEach, describe, expect, it, vi } from 'vitest';
import { haptics } from './haptics';

// Plain functions rather than vi.fn, and this is the thing the file turns on.
// A vitest spy records how a returned promise settles, which it does by
// attaching a handler to it, so the rejection is handled whether or not the
// wrapper handles it: with vi.fn the unhandled rejection test below passed
// against a wrapper whose catch had been deleted.
//
// Hoisted because vi.mock is: the factory runs while the import above is being
// resolved, which is before any const in this file exists.
const module = vi.hoisted(() => {
  const calls: { api: string; argument: string }[] = [];
  const effect = { run: (): Promise<void> => Promise.resolve() };

  return {
    calls,
    effect,

    impactAsync: (style: string): Promise<void> => {
      calls.push({ api: 'impactAsync', argument: style });

      return effect.run();
    },

    notificationAsync: (type: string): Promise<void> => {
      calls.push({ api: 'notificationAsync', argument: type });

      return effect.run();
    },
  };
});

// The string values are the ones in node_modules/expo-haptics/src/
// Haptics.types.ts, so the assertions below read as the real arguments rather
// than as stand-ins.
vi.mock('expo-haptics', () => ({
  impactAsync: module.impactAsync,
  notificationAsync: module.notificationAsync,
  ImpactFeedbackStyle: {
    Light: 'light',
    Medium: 'medium',
    Heavy: 'heavy',
    Soft: 'soft',
    Rigid: 'rigid',
  },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const intents = [
  { name: 'swipeCommitted', fire: () => haptics.swipeCommitted() },
  { name: 'matchMade', fire: () => haptics.matchMade() },
  { name: 'destructiveConfirmed', fire: () => haptics.destructiveConfirmed() },
];

// The failure this wrapper exists for, in the shape it actually arrives in:
// expo-haptics throws UnavailabilityError from inside an async function, so it
// reaches a caller as a rejected promise and never as a throw.
function rejects(): Promise<void> {
  return Promise.reject(new Error('The method or property Haptic.impactAsync is not available'));
}

// Vitest listens for unhandled rejections itself and fails the run on one, so
// its listeners are taken off for the duration and put back afterwards. Without
// that the control case below could not exist, and this helper would be
// asserting against a detector nothing had ever proved works.
async function unhandledDuring(run: () => void): Promise<unknown[]> {
  const existing = process.rawListeners(
    'unhandledRejection',
  ) as NodeJS.UnhandledRejectionListener[];
  const seen: unknown[] = [];

  process.removeAllListeners('unhandledRejection');
  process.on('unhandledRejection', (reason) => {
    seen.push(reason);
  });

  run();

  // Node only decides a rejection is unhandled once the microtask queue has
  // drained, so a macrotask is the earliest point this can be read.
  await new Promise((resolve) => {
    setTimeout(resolve, 10);
  });

  process.removeAllListeners('unhandledRejection');

  for (const listener of existing) {
    process.on('unhandledRejection', listener);
  }

  return seen;
}

beforeEach(() => {
  module.calls.length = 0;
  module.effect.run = () => Promise.resolve();
});

describe('haptics', () => {
  it('asks for the effect that belongs to each moment', () => {
    haptics.swipeCommitted();
    haptics.matchMade();
    haptics.destructiveConfirmed();

    expect(module.calls).toEqual([
      { api: 'impactAsync', argument: 'light' },
      { api: 'notificationAsync', argument: 'success' },
      { api: 'notificationAsync', argument: 'warning' },
    ]);
  });

  // A promise coming back out would eventually be awaited by somebody.
  it('returns nothing, so no call site can wait on one', () => {
    for (const intent of intents) {
      expect(intent.fire()).toBeUndefined();
    }
  });

  it('does not throw when the native module is missing', () => {
    module.effect.run = rejects;

    for (const intent of intents) {
      expect(intent.fire).not.toThrow();
    }
  });

  // Unreachable through expo-haptics 57.0.1, whose entry points are all async
  // functions. Asserted anyway because a call site cannot tell the difference
  // and must not have to.
  it('does not throw when the call throws instead of rejecting', () => {
    module.effect.run = () => {
      throw new Error('synchronous');
    };

    for (const intent of intents) {
      expect(intent.fire).not.toThrow();
    }
  });

  // The point of the wrapper. An unhandled rejection reaches the root error
  // boundary, so without this the app would swap a screen for an error view
  // over a vibration.
  it('leaves no unhandled rejection behind when the effect fails', async () => {
    module.effect.run = rejects;

    const seen = await unhandledDuring(() => {
      for (const intent of intents) {
        intent.fire();
      }
    });

    expect(seen).toEqual([]);
  });

  // Proves the assertion above can fail. The same rejection, not passed through
  // the wrapper, is caught by the same detector.
  it('is checked by a detector that sees an unhandled rejection', async () => {
    const seen = await unhandledDuring(() => {
      void rejects();
    });

    expect(seen).toHaveLength(1);
  });
});
