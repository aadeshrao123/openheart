import {
  CHALLENGES,
  judgeFace,
  poseMatchesChallenge,
  randomChallenge,
  randomChallengePair,
  YAW_IS_POSITIVE_TURNING_RIGHT,
  type VerificationChallenge,
} from './verification.ts';

function expect(actual: unknown, wanted: unknown, label: string): void {
  if (actual !== wanted) {
    throw new Error(`${label}: got ${String(actual)}, wanted ${String(wanted)}`);
  }
}

// The sign convention is a constant this file deliberately does not assume, so
// the expected direction is derived from it rather than written out. These
// assertions hold whichever way the calibration lands; what they check is that
// the four challenges stay distinct and opposite.
const right = YAW_IS_POSITIVE_TURNING_RIGHT ? 30 : -30;
const left = -right;

const facing = (yaw: number, pitch: number) => ({ Yaw: yaw, Pitch: pitch, Roll: 0 });

Deno.test('a head turned the way it was asked passes', () => {
  expect(poseMatchesChallenge(facing(left, 0), 'turn_left'), true, 'left');
  expect(poseMatchesChallenge(facing(right, 0), 'turn_right'), true, 'right');
  expect(poseMatchesChallenge(facing(0, 25), 'look_up'), true, 'up');
  expect(poseMatchesChallenge(facing(0, -25), 'look_down'), true, 'down');
});

// The one that matters. If this passes with the constant flipped, the challenge
// is not a liveness signal at all: any face in any pose satisfies any prompt.
Deno.test('a head turned the opposite way fails', () => {
  expect(poseMatchesChallenge(facing(right, 0), 'turn_left'), false, 'right for left');
  expect(poseMatchesChallenge(facing(left, 0), 'turn_right'), false, 'left for right');
  expect(poseMatchesChallenge(facing(0, -25), 'look_up'), false, 'down for up');
  expect(poseMatchesChallenge(facing(0, 25), 'look_down'), false, 'up for down');
});

Deno.test('a face looking straight ahead satisfies nothing', () => {
  for (const challenge of CHALLENGES) {
    expect(poseMatchesChallenge(facing(0, 0), challenge), false, challenge);
  }
});

// Turning far enough to hide half the face is not a better version of turning.
Deno.test('a rotation past the band fails at both ends', () => {
  expect(poseMatchesChallenge(facing(left / 3, 0), 'turn_left'), false, 'barely turned');
  expect(poseMatchesChallenge(facing(left * 3, 0), 'turn_left'), false, 'turned away');
});

Deno.test('a pose with no numbers in it fails', () => {
  expect(poseMatchesChallenge({}, 'turn_left'), false, 'empty');
  expect(poseMatchesChallenge({ Yaw: null, Pitch: null }, 'turn_left'), false, 'nulls');
  expect(poseMatchesChallenge({ Yaw: '30', Pitch: 0 }, 'turn_right'), false, 'strings');
  expect(poseMatchesChallenge({ Yaw: NaN, Pitch: 0 }, 'turn_right'), false, 'NaN');
});

const good = {
  Pose: facing(left, 0),
  Confidence: 99.9,
  Quality: { Brightness: 60, Sharpness: 50 },
  EyesOpen: { Value: true },
  Sunglasses: { Value: false },
  FaceOccluded: { Value: false },
};

const reasonFor = (face: unknown, challenge: VerificationChallenge = 'turn_left'): string => {
  const outcome = judgeFace([face] as Parameters<typeof judgeFace>[0], challenge);

  return outcome.passed ? 'passed' : outcome.reason;
};

Deno.test('a clear face in the right pose passes', () => {
  expect(reasonFor(good), 'passed', 'good face');
});

Deno.test('an empty frame and a crowd both fail, differently', () => {
  expect(judgeFace([], 'turn_left').passed, false, 'no face passes');
  expect(reasonFor(good) === 'passed', true, 'one face');

  const two = judgeFace(
    [good, good] as Parameters<typeof judgeFace>[0],
    'turn_left',
  );

  expect(two.passed, false, 'two faces');
  expect(two.passed ? '' : two.reason, 'multiple_faces', 'two faces reason');
});

// Each of these is a real reason a real person fails, and each has to come back
// distinctly, because the reason is what a moderator reads in the queue.
Deno.test('every rejection says which one it was', () => {
  expect(reasonFor({ ...good, FaceOccluded: { Value: true } }), 'face_covered', 'covered');
  expect(reasonFor({ ...good, Sunglasses: { Value: true } }), 'sunglasses', 'sunglasses');
  expect(reasonFor({ ...good, EyesOpen: { Value: false } }), 'eyes_closed', 'eyes');
  expect(reasonFor({ ...good, Confidence: 40 }), 'low_confidence', 'confidence');
  expect(
    reasonFor({ ...good, Quality: { Brightness: 60, Sharpness: 2 } }),
    'too_blurry',
    'blur',
  );
  expect(
    reasonFor({ ...good, Quality: { Brightness: 3, Sharpness: 50 } }),
    'too_dark',
    'dark',
  );
  expect(reasonFor(good, 'turn_right'), 'pose_mismatch', 'wrong pose');
});

// Missing rather than false. An attribute Rekognition did not return is not
// evidence that the thing is fine.
Deno.test('a face detail with fields missing fails rather than assuming', () => {
  expect(reasonFor({ Pose: facing(left, 0) }), 'low_confidence', 'no confidence');
  expect(
    reasonFor({ Pose: facing(left, 0), Confidence: 99 }),
    'too_blurry',
    'no quality',
  );
});

Deno.test('the challenge is one of the four and varies', () => {
  const seen = new Set<string>();

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const challenge = randomChallenge();

    expect(CHALLENGES.includes(challenge), true, `${challenge} is a known challenge`);
    seen.add(challenge);
  }

  // A constant challenge would let one prepared photo pass forever.
  expect(seen.size, CHALLENGES.length, 'all four appear');
});

// The same pose twice is one photo used twice, and it is the one pair that
// proves nothing. If this ever passes with a repeat, two poses cost twice as
// much as one and buy nothing.
Deno.test('the pair is always two different poses', () => {
  const pairs = new Set<string>();

  for (let attempt = 0; attempt < 500; attempt += 1) {
    const [first, second] = randomChallengePair();

    expect(CHALLENGES.includes(first), true, `${first} is a known challenge`);
    expect(CHALLENGES.includes(second), true, `${second} is a known challenge`);
    expect(first === second, false, `${first} repeated`);

    pairs.add(`${first}:${second}`);
  }

  // Four choices for the first and three for the second, and order matters
  // because the screen asks for them in order.
  expect(pairs.size, CHALLENGES.length * (CHALLENGES.length - 1), 'all twelve appear');
});
