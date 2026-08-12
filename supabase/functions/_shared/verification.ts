import { AwsClient } from 'npm:aws4fetch@1.0.20';

import { requireEnv } from './env.ts';

export type VerificationChallenge = 'turn_left' | 'turn_right' | 'look_up' | 'look_down';

export const CHALLENGES: readonly VerificationChallenge[] = [
  'turn_left',
  'turn_right',
  'look_up',
  'look_down',
];

// A reason code, never a similarity score. A score is a biometric measurement
// and a moderator does not need one to look at a photo and a pose.
export type VerificationOutcome =
  | { passed: true }
  | { passed: false; reason: string };

export type Pose = {
  Yaw?: unknown;
  Pitch?: unknown;
  Roll?: unknown;
};

// THE ONE VALUE THAT NEEDS A REAL CAPTURE BEFORE THIS IS TURNED ON.
//
// AWS documents Pose.Yaw and Pose.Pitch as -180 to 180 and does not document
// which direction is positive. Get it backwards and "turn left" accepts a face
// turned right: the challenge still passes, still looks like it works, and
// stops being a liveness signal at all.
//
// scripts/calibrate-pose.mjs sends one selfie and prints what came back. Turn
// your head to your own left, run it, and if Yaw is negative this is correct.
export const YAW_IS_POSITIVE_TURNING_RIGHT = true;

// Deliberately wide. The instruction is "turn your head", not "hold 30 degrees",
// and a band that demands precision fails real people holding a phone one
// handed. The floor is what makes it a pose rather than a straight-on face.
const MIN_ROTATION_DEGREES = 15;
const MAX_ROTATION_DEGREES = 55;

// Rekognition's own scale. Below this a face is too dark or too soft to compare
// against anything, and a comparison on a bad frame is what produces a false
// rejection of a real person.
const MIN_SHARPNESS = 20;
const MIN_BRIGHTNESS = 25;
const MIN_FACE_CONFIDENCE = 95;

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// Exported for its own test. The sign convention is applied here and nowhere
// else, so flipping the constant above flips every challenge at once.
export function poseMatchesChallenge(pose: Pose, challenge: VerificationChallenge): boolean {
  const yaw = readNumber(pose.Yaw);
  const pitch = readNumber(pose.Pitch);

  if (yaw === null || pitch === null) {
    return false;
  }

  const rightward = YAW_IS_POSITIVE_TURNING_RIGHT ? yaw : -yaw;

  const withinBand = (value: number) =>
    value >= MIN_ROTATION_DEGREES && value <= MAX_ROTATION_DEGREES;

  switch (challenge) {
    case 'turn_left':
      return withinBand(-rightward);
    case 'turn_right':
      return withinBand(rightward);
    case 'look_up':
      return withinBand(pitch);
    case 'look_down':
      return withinBand(-pitch);
  }
}

type FaceDetail = {
  Pose?: Pose;
  Confidence?: unknown;
  Quality?: { Brightness?: unknown; Sharpness?: unknown };
  EyesOpen?: { Value?: unknown };
  Sunglasses?: { Value?: unknown };
  FaceOccluded?: { Value?: unknown };
};

// Exported so the whole decision is testable without a network call. Every
// branch returns a reason a moderator can read, because these land in a review
// queue rather than in a log nobody opens.
export function judgeFace(
  faces: FaceDetail[],
  challenge: VerificationChallenge,
): VerificationOutcome {
  if (faces.length === 0) {
    return { passed: false, reason: 'no_face' };
  }

  // More than one face is the "hold up a photo of someone else" shape, and it
  // also makes the comparison below ambiguous about who was compared.
  if (faces.length > 1) {
    return { passed: false, reason: 'multiple_faces' };
  }

  const face = faces[0];
  const confidence = readNumber(face.Confidence);

  if (confidence === null || confidence < MIN_FACE_CONFIDENCE) {
    return { passed: false, reason: 'low_confidence' };
  }

  if (face.FaceOccluded?.Value === true) {
    return { passed: false, reason: 'face_covered' };
  }

  if (face.Sunglasses?.Value === true) {
    return { passed: false, reason: 'sunglasses' };
  }

  if (face.EyesOpen?.Value === false) {
    return { passed: false, reason: 'eyes_closed' };
  }

  const sharpness = readNumber(face.Quality?.Sharpness);
  const brightness = readNumber(face.Quality?.Brightness);

  if (sharpness === null || sharpness < MIN_SHARPNESS) {
    return { passed: false, reason: 'too_blurry' };
  }

  if (brightness === null || brightness < MIN_BRIGHTNESS) {
    return { passed: false, reason: 'too_dark' };
  }

  if (!poseMatchesChallenge(face.Pose ?? {}, challenge)) {
    return { passed: false, reason: 'pose_mismatch' };
  }

  return { passed: true };
}

// The threshold a comparison has to clear. AWS returns matches at 80 by
// default; this asks for more because the cost of a wrong pass is a verified
// impostor and the cost of a wrong fail is a human looking at it.
const SIMILARITY_THRESHOLD = 90;

// AWS: "To reduce the probability of false negatives, we recommend that you
// compare the target image against multiple source images." Capped because
// every one is a billed call and an unbounded loop is somebody else's money.
const MAX_COMPARISONS = 3;

export type VerificationProvider = {
  checkLiveness(
    selfie: Uint8Array<ArrayBuffer>,
    challenge: VerificationChallenge,
  ): Promise<VerificationOutcome>;

  matchFace(
    selfie: Uint8Array<ArrayBuffer>,
    photos: Uint8Array<ArrayBuffer>[],
  ): Promise<VerificationOutcome>;
};

function toBase64(bytes: Uint8Array<ArrayBuffer>): string {
  const CHUNK = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }

  return btoa(binary);
}

// Split into two methods rather than one, because only the first is ever going
// to be replaced. AWS Face Liveness has no React Native SDK today, and when it
// does the pose challenge becomes a session and this becomes its result read.
// matchFace is the same call either way: Face Liveness hands back a reference
// image and CompareFaces is what you do with it.
export function createRekognitionVerificationProvider(): VerificationProvider {
  const region = requireEnv('AWS_REGION');

  const signer = new AwsClient({
    accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    service: 'rekognition',
    region,
  });

  const call = async (target: string, body: unknown): Promise<unknown> => {
    const response = await signer.fetch(`https://rekognition.${region}.amazonaws.com/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `RekognitionService.${target}`,
      },
      body: JSON.stringify(body),
    });

    // Thrown, not answered. A scanner that cannot answer leaves the attempt
    // pending and retryable rather than verifying or rejecting on an outage.
    if (!response.ok) {
      throw new Error(`Rekognition ${target} returned ${response.status}`);
    }

    return await response.json();
  };

  return {
    async checkLiveness(selfie, challenge) {
      const payload = await call('DetectFaces', {
        Image: { Bytes: toBase64(selfie) },
        // Pose and Quality are in DEFAULT; the rest have to be asked for.
        Attributes: ['DEFAULT', 'EYES_OPEN', 'SUNGLASSES', 'FACE_OCCLUDED'],
      });

      const faces = (payload as { FaceDetails?: unknown }).FaceDetails;

      if (!Array.isArray(faces)) {
        throw new Error('DetectFaces response had no FaceDetails array');
      }

      return judgeFace(faces as FaceDetail[], challenge);
    },

    async matchFace(selfie, photos) {
      if (photos.length === 0) {
        return { passed: false, reason: 'no_photos_to_compare' };
      }

      for (const photo of photos.slice(0, MAX_COMPARISONS)) {
        // CompareFaces raises rather than answering when either image has no
        // face in it, and a profile photo of a landscape is a normal thing to
        // find. That is not a failed comparison, it is one that never ran.
        let payload: unknown;

        try {
          payload = await call('CompareFaces', {
            SourceImage: { Bytes: toBase64(selfie) },
            TargetImage: { Bytes: toBase64(photo) },
            SimilarityThreshold: SIMILARITY_THRESHOLD,
            QualityFilter: 'AUTO',
          });
        } catch (error) {
          console.error('face comparison skipped', error);
          continue;
        }

        const matches = (payload as { FaceMatches?: unknown }).FaceMatches;

        // One match against any profile photo is enough. Requiring all of them
        // fails anyone whose older photos are genuinely theirs and genuinely
        // different, which is most people with a photo from five years ago.
        if (Array.isArray(matches) && matches.length > 0) {
          return { passed: true };
        }
      }

      return { passed: false, reason: 'no_match' };
    },
  };
}

// Chosen here rather than by the client. A client that picks its own challenge
// picks the one it has already prepared a photo for.
export function randomChallenge(): VerificationChallenge {
  return CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
}
