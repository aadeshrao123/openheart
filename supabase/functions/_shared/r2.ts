import { AwsClient } from 'npm:aws4fetch@1.0.20';

import { requireEnv } from './env.ts';

// Uploads land here and nowhere else. Nothing promotes an approved object out
// of this prefix yet, so the prefix is a label and the real gate is the photos
// row: a client cannot learn a key it has no readable row for. Promoting on
// approval is an open decision, see ../README.md.
const QUARANTINE_PREFIX = 'quarantine/';

// R2 ignores the region but SigV4 requires one in the credential scope, and the
// endpoint is per account rather than per region.
// https://developers.cloudflare.com/r2/api/s3/presigned-urls/
const R2_REGION = 'auto';

export type R2Client = {
  signer: AwsClient;
  bucketUrl: string;
};

export function createR2Client(): R2Client {
  const accountId = requireEnv('R2_ACCOUNT_ID');
  const bucket = requireEnv('R2_BUCKET');

  const signer = new AwsClient({
    accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    service: 's3',
    region: R2_REGION,
  });

  const bucketUrl = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;

  return { signer, bucketUrl };
}

// 122 bits of entropy, so the key cannot be walked even by someone who knows
// another user's key. The bucket itself is private; this is defence in depth.
export function quarantineKey(): string {
  return `${QUARANTINE_PREFIX}${crypto.randomUUID()}`;
}

export async function presignUpload(
  r2: R2Client,
  key: string,
  expiresInSeconds: number,
): Promise<string> {
  const url = new URL(`${r2.bucketUrl}/${key}`);

  // aws4fetch defaults S3 query signing to 24 hours when X-Amz-Expires is
  // absent, which is far longer than a single upload ever needs.
  url.searchParams.set('X-Amz-Expires', String(expiresInSeconds));

  const signed = await r2.signer.sign(url.toString(), {
    method: 'PUT',
    aws: { signQuery: true },
  });

  return signed.url;
}

export async function getObject(r2: R2Client, key: string): Promise<Response> {
  return await r2.signer.fetch(`${r2.bucketUrl}/${key}`, { method: 'GET' });
}

export async function deleteObject(r2: R2Client, key: string): Promise<Response> {
  return await r2.signer.fetch(`${r2.bucketUrl}/${key}`, { method: 'DELETE' });
}
