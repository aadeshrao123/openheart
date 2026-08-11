// Grants or revokes the moderator claim that is_moderator() reads out of the
// JWT. There is no UI for this on purpose: a screen that appoints moderators is
// a screen that can be tricked into appointing one.
//
//   node scripts/grant-moderator.mjs --email me@test.dev
//   node scripts/grant-moderator.mjs --email me@test.dev --revoke
//
// Local by default. To target a deployment, set both SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY and it will say so before it writes.
//
// app_metadata is admin-only in GoTrue: a client PUT of it returns 403
// not_admin, verified against this project. That is what makes the claim safe
// to trust in an RLS policy.

import { execFileSync } from 'node:child_process';
import { argv, env, exit } from 'node:process';

function arg(name) {
  const index = argv.indexOf(`--${name}`);

  return index === -1 ? undefined : argv[index + 1];
}

const email = arg('email');
const revoke = argv.includes('--revoke');

if (!email) {
  console.error('Usage: node scripts/grant-moderator.mjs --email <address> [--revoke]');
  exit(1);
}

function target() {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    return { url: env.SUPABASE_URL, key: env.SUPABASE_SERVICE_ROLE_KEY, local: false };
  }

  const status = execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' });
  const parsed = JSON.parse(status.slice(status.indexOf('{')));

  return { url: parsed.API_URL, key: parsed.SERVICE_ROLE_KEY, local: true };
}

const { url, key, local } = target();

console.log(`${local ? 'Local' : 'REMOTE'}: ${url}`);

async function admin(path, options = {}) {
  const response = await fetch(`${url}/auth/v1/admin${path}`, {
    ...options,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${text.slice(0, 200)}`);
  }

  return text ? JSON.parse(text) : null;
}

const page = await admin(`/users?page=1&per_page=1000`);
const user = page.users.find((candidate) => candidate.email === email);

if (!user) {
  console.error(`No user with the address ${email}.`);
  exit(1);
}

// Spread the existing metadata: it also carries the provider list, and
// replacing the object wholesale would drop it.
const updated = await admin(`/users/${user.id}`, {
  method: 'PUT',
  body: JSON.stringify({
    app_metadata: { ...user.app_metadata, moderator: revoke ? null : true },
  }),
});

console.log(`${revoke ? 'Revoked' : 'Granted'} moderator for ${email}`);
console.log(`app_metadata: ${JSON.stringify(updated.app_metadata)}`);
console.log('');
console.log('The claim is read from the JWT, so they need to sign out and back');
console.log('in before it takes effect.');
