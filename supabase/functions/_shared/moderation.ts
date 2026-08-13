import { AwsClient } from 'npm:aws4fetch@1.0.20';

import { requireEnv } from './env.ts';

export type ModerationVerdict = 'approved' | 'rejected';

// The verdict alone loses the thing that matters most. A known-CSAM match and a
// photo of a beer both rejected, and nothing downstream could tell them apart,
// so an incident could be neither reported nor preserved.
export type ModerationResult = {
  verdict: ModerationVerdict;
  detail: string;
};

// Uint8Array<ArrayBuffer> and not a bare Uint8Array. Bare, the buffer type is
// ArrayBufferLike, which includes SharedArrayBuffer, and nothing that takes a
// request body accepts one of those. The bytes here are always read out of an
// R2 response with `new Uint8Array(await object.arrayBuffer())`, so the narrower
// type is what is actually being passed rather than a cast to quiet a checker.
export type ImageModerationProvider = {
  scanImage(bytes: Uint8Array<ArrayBuffer>, contentType: string): Promise<ModerationResult>;
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
function toBase64(bytes: Uint8Array<ArrayBuffer>): string {
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
    async scanImage(bytes: Uint8Array<ArrayBuffer>): Promise<ModerationResult> {
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
          return { verdict: 'rejected', detail: 'adult' };
        }
      }

      return { verdict: 'approved', detail: 'clean' };
    },
  };
}

// Arachnid Shield, from the Canadian Centre for Child Protection. Free, and a
// signup rather than PhotoDNA's qualification process.
//
// STILL UNSETTLED, AND IT IS A LEGAL QUESTION RATHER THAN A CODE ONE: a hit
// obliges preserving the object and filing a report, which the REPORT Act
// extended to a year, and that contradicts the deleted_media purge path. Wiring
// the scanner in does not answer it. Reporting is a route this code does not
// have, so a match today rejects the photo and tells nobody.
// https://shield.projectarachnid.com/docs/
const SHIELD_MEDIA_URL = 'https://shield.projectarachnid.com/v1/media';

type ShieldResponse = {
  classification?: unknown;
};

// An allow list of exactly one value, for the same reason ALLOWED_LABELS is one
// above: a classification this file has never heard of, including any value
// added to the enum later, rejects rather than passing.
//
// `test` is in the reject set deliberately. It is the value their test fixture
// returns, so the integration can be proved end to end without anyone touching
// real material, and it only proves anything if a match actually rejects.
export function verdictForClassification(classification: unknown): ModerationVerdict {
  return classification === 'no-known-match' ? 'approved' : 'rejected';
}

// Bytes rather than the /v1/pdq hash endpoint, and it is a close call. Sending
// only a perceptual hash would keep the photo on our own infrastructure, which
// is the better privacy story and the one this project would normally pick.
// The catch is the failure mode: PDQ has no implementation in this toolchain,
// and a hand-written one that is subtly wrong returns hashes that match
// nothing. That reads as "no-known-match" and publishes the photo. A wrong
// hash fails open silently, which is the one direction this must never fail.
// Revisit with a PDQ library that has test vectors to check against.
export function createArachnidShieldProvider(): ImageModerationProvider {
  const username = requireEnv('ARACHNID_SHIELD_USERNAME');
  const password = requireEnv('ARACHNID_SHIELD_PASSWORD');

  // Basic, taken from the server's own WWW-Authenticate challenge. The OpenAPI
  // document declares no security scheme at all, so it is not the source here.
  const credentials = btoa(`${username}:${password}`);

  return {
    async scanImage(
      bytes: Uint8Array<ArrayBuffer>,
      contentType: string,
    ): Promise<ModerationResult> {
      // Raw body, no multipart. Their spec: "The file must be submitted as the
      // body of the request, with no HTTP form or other encoding."
      const response = await fetch(SHIELD_MEDIA_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': contentType,
        },
        // Wrapped, because a Uint8Array is not a BodyInit to the type checker
        // once it carries its ArrayBufferLike parameter. A Blob is, it sends
        // the same raw bytes, and it does not copy them the way passing a
        // sliced buffer would.
        body: new Blob([bytes]),
      });

      // Thrown rather than rejected, same as Rekognition: a scanner that cannot
      // answer leaves the photo pending and retryable. An outage is not a
      // verdict in either direction.
      if (!response.ok) {
        throw new Error(`Arachnid Shield returned ${response.status}`);
      }

      const payload: ShieldResponse = await response.json();

      if (typeof payload.classification !== 'string') {
        throw new Error('Arachnid Shield response carried no classification');
      }

      return {
        verdict: verdictForClassification(payload.classification),
        detail: payload.classification,
      };
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
//
// What the pair does and does not cover, so nobody has to infer it. Rekognition
// answers "is this explicit", Shield answers "is this a known image". Neither
// answers "is this abuse material nobody has catalogued yet": both are the
// wrong tool for novel content, Shield because hash matching only ever finds
// what is already in the list. Closing that needs a classifier, and the two
// that exist both require qualifying as a partner.
export function createModerationProvider(): ImageModerationProvider {
  const providers = [createRekognitionProvider(), createArachnidShieldProvider()];

  return {
    async scanImage(
      bytes: Uint8Array<ArrayBuffer>,
      contentType: string,
    ): Promise<ModerationResult> {
      for (const provider of providers) {
        const result = await provider.scanImage(bytes, contentType);

        // The first refusal wins and carries its own detail, so the caller
        // learns which scanner objected and to what.
        if (result.verdict === 'rejected') {
          return result;
        }
      }

      return { verdict: 'approved', detail: 'clean' };
    },
  };
}
