import { AwsClient } from 'npm:aws4fetch@1.0.20';

import { requireEnv } from './env.ts';

export type ModerationVerdict = 'approved' | 'rejected';

export type ImageModerationProvider = {
  scanImage(bytes: Uint8Array, contentType: string): Promise<ModerationVerdict>;
};

// 50 is Rekognition's own default. Below it the docs warn of a high
// false-positive rate, and with the allow list below a false positive is a
// rejected holiday photo, so recall is not free.
const MIN_CONFIDENCE = 50;

// An allow list, not a block list, because it is the only form that fails
// closed: a label this file has never heard of, including anything AWS adds to
// the taxonomy later, is rejected rather than waved through.
//
// The contents are a product decision, not a technical one, and this is the
// line to edit. A dating app that rejects every beach photo has no users, and
// one that publishes explicit images has a different problem. Ancestors are
// listed because Rekognition returns the whole chain: an image labelled
// L3 "Exposed Male Nipple" also carries its L2 and L1.
//
// Taxonomy v7, verified against
// docs.aws.amazon.com/rekognition/latest/dg/moderation-api.html
const ALLOWED_LABELS: ReadonlySet<string> = new Set([
  // Swimwear is the single most common photo on a dating profile.
  'Swimwear or Underwear',
  'Female Swimwear or Underwear',
  'Male Swimwear or Underwear',

  // A drink in shot is not a safety problem.
  'Alcohol',
  'Alcohol Use',
  'Alcoholic Beverages',
  'Drinking',

  'Rude Gestures',
  'Middle Finger',
  'Gambling',

  // Shirtless and back shots. The rejectable siblings under the same parents,
  // such as Implied Nudity and Partially Exposed Female Breast, are absent, so
  // they still fail even though their ancestors appear here.
  'Non-Explicit Nudity of Intimate parts and Kissing',
  'Non-Explicit Nudity',
  'Bare Back',
  'Exposed Male Nipple',
  'Kissing on the Lips',
]);

type RekognitionLabel = {
  Name?: unknown;
};

type RekognitionResponse = {
  ModerationLabels?: unknown;
};

// btoa needs a binary string, and spreading a multi-megabyte array into
// fromCharCode overflows the call stack, hence the chunking.
function toBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }

  return btoa(binary);
}

// Adult content only. AWS is explicit that this does not detect CSAM, which is
// why it is never used on its own. See createModerationProvider.
export function createRekognitionProvider(): ImageModerationProvider {
  const region = requireEnv('AWS_REGION');

  const signer = new AwsClient({
    accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
    service: 'rekognition',
    region,
  });

  return {
    async scanImage(bytes: Uint8Array): Promise<ModerationVerdict> {
      // Endpoint, target header and content type taken from the AWS CLI's own
      // debug output for DetectModerationLabels rather than from memory.
      const response = await signer.fetch(`https://rekognition.${region}.amazonaws.com/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-amz-json-1.1',
          'X-Amz-Target': 'RekognitionService.DetectModerationLabels',
        },
        body: JSON.stringify({
          Image: { Bytes: toBase64(bytes) },
          MinConfidence: MIN_CONFIDENCE,
        }),
      });

      // Thrown, not rejected. A scanner that cannot answer leaves the photo
      // pending and retryable; treating an outage as a verdict would either
      // publish unscanned photos or destroy good ones.
      if (!response.ok) {
        throw new Error(`Rekognition returned ${response.status}`);
      }

      const payload: RekognitionResponse = await response.json();
      const labels = payload.ModerationLabels;

      if (!Array.isArray(labels)) {
        throw new Error('Rekognition response had no ModerationLabels array');
      }

      for (const label of labels as RekognitionLabel[]) {
        const name = label.Name;

        // A label with no readable name is not something to guess about.
        if (typeof name !== 'string' || !ALLOWED_LABELS.has(name)) {
          return 'rejected';
        }
      }

      return 'approved';
    },
  };
}

// No CSAM provider exists yet. This is not an oversight to be removed: it is
// what stops the app approving photos that have only been checked for nudity.
//
// A maintainer wiring one in replaces this and must settle first that a hit
// obliges preserving the object and filing a report, which the REPORT Act
// extended to a year, and that this contradicts the deleted_media purge path.
// That is a legal question and it gates the code, not the other way round.
export function createCsamProvider(): ImageModerationProvider {
  return {
    scanImage(): Promise<ModerationVerdict> {
      return Promise.reject(
        new Error('No CSAM provider is configured. See _shared/moderation.ts'),
      );
    },
  };
}

// Every check must be present and every check must pass. Wiring adult-content
// scanning alone would let photos reach approved having been checked for one
// thing and not the other, and "upload now, scan the rest later" cannot be
// undone without a full backfill and a key rotation.
//
// Constructing the providers is itself part of the gate: each one reads its
// credentials on creation, so a missing secret throws here and moderate-photo
// answers 503 with the row left pending.
export function createModerationProvider(): ImageModerationProvider {
  const providers = [createRekognitionProvider(), createCsamProvider()];

  return {
    async scanImage(bytes: Uint8Array, contentType: string): Promise<ModerationVerdict> {
      for (const provider of providers) {
        const verdict = await provider.scanImage(bytes, contentType);

        if (verdict === 'rejected') {
          return 'rejected';
        }
      }

      return 'approved';
    },
  };
}
