// Turns an IAM secret access key into an SES SMTP password. There is no API
// for this, and the two are not interchangeable.
//
//   aws iam create-access-key --user-name openheart-mailer \
//     | SES_REGION=eu-central-1 OUT_FILE=.env.smtp node scripts/ses-smtp-password.mjs
//
// Writes to a gitignored file so the secret never reaches a terminal.

import { createHmac } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const REGION = process.env.SES_REGION;
const OUT = process.env.OUT_FILE;

const input = JSON.parse(await new Promise((resolve) => {
  let buffer = '';
  process.stdin.on('data', (chunk) => (buffer += chunk));
  process.stdin.on('end', () => resolve(buffer));
}));

const { AccessKeyId, SecretAccessKey } = input.AccessKey;

const sign = (key, message) => createHmac('sha256', key).update(message).digest();

let signature = sign(`AWS4${SecretAccessKey}`, '11111111');
signature = sign(signature, REGION);
signature = sign(signature, 'ses');
signature = sign(signature, 'aws4_request');
signature = sign(signature, 'SendRawEmail');

const password = Buffer.concat([Buffer.from([0x04]), signature]).toString('base64');

writeFileSync(
  OUT,
  [
    '# SES SMTP credentials for Supabase. Gitignored. Paste into the dashboard',
    '# under Authentication, SMTP Settings, then this file can be deleted.',
    '',
    `SMTP_HOST=email-smtp.${REGION}.amazonaws.com`,
    'SMTP_PORT=465',
    `SMTP_USER=${AccessKeyId}`,
    `SMTP_PASS=${password}`,
    'SMTP_SENDER=no-reply@send.openheartapp.org',
    'SMTP_SENDER_NAME=OpenHeart',
    '',
  ].join('\n'),
  'utf8',
);

process.stdout.write(`written to ${OUT}\n`);
process.stdout.write(`smtp user ${AccessKeyId.slice(0, 8)}... password derived, 44 chars\n`);
