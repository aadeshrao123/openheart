import { AwsClient } from 'npm:aws4fetch@1.0.20';

import { presignDownload, presignUpload, type R2Client } from './r2.ts';

// Signing is arithmetic, so fake credentials produce a real signature and this
// needs no network.
const r2: R2Client = {
  signer: new AwsClient({
    accessKeyId: 'test-access-key',
    secretAccessKey: 'test-secret-key',
    service: 's3',
    region: 'auto',
  }),
  bucketUrl: 'https://account.r2.cloudflarestorage.com/openheart-photos-test',
};

function expect(actual: unknown, wanted: unknown, label: string): void {
  if (actual !== wanted) {
    throw new Error(`${label}: got ${String(actual)}, wanted ${String(wanted)}`);
  }
}

// aws4fetch defaults query signing to 24 hours when X-Amz-Expires is absent,
// which is why the parameter is set explicitly.
Deno.test('a download URL carries the expiry it was asked for', async () => {
  const url = new URL(await presignDownload(r2, 'verification/abc', 300));

  expect(url.searchParams.get('X-Amz-Expires'), '300', 'expiry');
  expect(url.pathname, '/openheart-photos-test/verification/abc', 'path');
});

Deno.test('a download URL is signed, and signed for GET', async () => {
  const url = new URL(await presignDownload(r2, 'verification/abc', 300));

  // Present and non-empty, because the value depends on the clock.
  const signature = url.searchParams.get('X-Amz-Signature');

  expect(typeof signature === 'string' && signature.length > 0, true, 'signature');

  // What stops a read URL being replayed as a write.
  const upload = new URL(await presignUpload(r2, 'verification/abc', 300));

  expect(
    url.searchParams.get('X-Amz-Signature') !== upload.searchParams.get('X-Amz-Signature'),
    true,
    'a read and a write of the same key sign differently',
  );
});
