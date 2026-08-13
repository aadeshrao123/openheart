// Confirms the Arachnid Shield credentials work, before anything depends on
// them. Reads supabase/functions/.env and prints the classification only, never
// the credential.
//
//   node scripts/check-shield.mjs [path-to-an-image]
//
// Expected on a healthy setup: 200, no-known-match, approved.
// 401 means the credentials are wrong or not yet activated on their side.

import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHIELD_MEDIA_URL = 'https://shield.projectarachnid.com/v1/media';

function readEnv(file) {
  const values = {};

  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());

    if (match) {
      values[match[1]] = match[2];
    }
  }

  return values;
}

function detectImageFormat(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return 'image/jpeg';
  }

  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    return 'image/png';
  }

  return null;
}

const env = readEnv(path.join(ROOT, 'supabase', 'functions', '.env'));
const username = env.ARACHNID_SHIELD_USERNAME;
const password = env.ARACHNID_SHIELD_PASSWORD;

if (!username || !password) {
  console.error('Missing ARACHNID_SHIELD_USERNAME or ARACHNID_SHIELD_PASSWORD');
  console.error('Add both to supabase/functions/.env, then run this again.');
  process.exit(1);
}

const imagePath = process.argv[2] ?? path.join(ROOT, 'assets', 'icon.png');
const bytes = readFileSync(imagePath);
const contentType = detectImageFormat(bytes);

if (!contentType) {
  console.error(`${imagePath} is not a JPEG or PNG`);
  process.exit(1);
}

console.log(`Sending ${path.basename(imagePath)} (${contentType}, ${bytes.length} bytes)`);

const response = await fetch(SHIELD_MEDIA_URL, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    'Content-Type': contentType,
  },
  body: bytes,
});

console.log(`HTTP ${response.status}`);

if (response.status === 401) {
  console.error('Rejected. The credentials are wrong, or not activated yet.');
  process.exit(1);
}

const body = await response.json().catch(() => null);

if (!response.ok) {
  console.error('Shield refused the request.');
  console.error(JSON.stringify(body, null, 2));
  process.exit(1);
}

const classification = body?.classification;

console.log(`classification: ${classification}`);
console.log(
  classification === 'no-known-match'
    ? 'Credentials work, and this image would be approved.'
    : 'Credentials work. This image would be rejected, which is the point.',
);
