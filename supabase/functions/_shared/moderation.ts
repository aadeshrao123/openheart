export type ModerationVerdict = 'approved' | 'rejected';

export type ImageModerationProvider = {
  scanImage(bytes: Uint8Array, contentType: string): Promise<ModerationVerdict>;
};

// No provider is wired up. Nothing here calls a real moderation API, because a
// signature guessed from memory would look correct in review and fail in
// production on the one control the whole safety model rests on.
//
// A maintainer replacing this must supply, in this file:
//
//   1. A provider that classifies both adult nudity and CSAM. Generic "unsafe
//      image" APIs do not cover CSAM. That requires an enrolled hash-matching
//      service (Thorn Safer, Microsoft PhotoDNA) or a vendor that includes it.
//   2. Credentials read through requireEnv from './env.ts', added to the secret
//      list in ../README.md, and never inlined.
//   3. A mapping from the provider's response to a ModerationVerdict. Anything
//      the provider is unsure about maps to 'rejected'.
//   4. The provider's confirmed handling of a CSAM hit. Most contracts require
//      preserving the object and filing a report rather than deleting it, which
//      conflicts with the deleted_media purge path and must be resolved before
//      this ships.
//
// Until then every call fails, moderate-photo answers 503, and no photo is ever
// approved. That is the correct failure direction.
export const unconfiguredModerationProvider: ImageModerationProvider = {
  scanImage(): Promise<ModerationVerdict> {
    return Promise.reject(
      new Error('No image moderation provider is configured. See _shared/moderation.ts'),
    );
  },
};
