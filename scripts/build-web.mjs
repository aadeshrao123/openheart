// Builds the web bundle for deployment, and refuses to hand over one that
// points at a database nobody can reach.
//
//   node scripts/build-web.mjs
//
// Reads .env.production when it exists, which is how a laptop supplies the
// values, and otherwise uses whatever the environment already holds, which is
// how CI supplies them. Explicit environment variables win over Expo's dotenv
// precedence either way.
//
// This exists because `expo export` quietly used .env and baked localhost into
// a bundle that was about to be deployed. It built, it was 21KB a route, and
// every request it made would have gone nowhere.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ENV_FILE = path.join(ROOT, '.env.production');

const REQUIRED = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_IMAGE_BASE_URL',
];

const env = { ...process.env, NODE_ENV: 'production' };

if (existsSync(ENV_FILE)) {
  for (const line of readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());

    if (match) {
      env[match[1]] = match[2];
    }
  }

  console.log('read .env.production');
} else {
  console.log('no .env.production, using the ambient environment');
}

const missing = REQUIRED.filter((name) => !env[name]);

if (missing.length) {
  console.error(`Missing: ${missing.join(', ')}`);
  process.exit(1);
}

// Expo's own entry through node, rather than npx. shell: true is deprecated
// because arguments are concatenated instead of escaped, and npx.cmd cannot be
// spawned directly on Windows at all.
execFileSync(process.execPath, [
  path.join(ROOT, 'node_modules', 'expo', 'bin', 'cli'),
  'export',
  '--platform',
  'web',
  '--clear',
], { cwd: ROOT, env, stdio: 'inherit' });

// The check the failure above earned. A bundle is a pile of hashed files, so
// this reads them rather than trusting that the right variable was in scope.
const bundleDir = path.join(ROOT, 'dist', '_expo', 'static', 'js', 'web');
const bundles = readdirSync(bundleDir).filter((f) => f.endsWith('.js'));
const source = bundles.map((f) => readFileSync(path.join(bundleDir, f), 'utf8')).join('');

const expectedHost = new URL(env.EXPO_PUBLIC_SUPABASE_URL).host;

if (!source.includes(expectedHost)) {
  console.error(`\nThe bundle does not mention ${expectedHost}. Wrong environment.`);
  process.exit(1);
}

const localhost = ['127.0.0.1:54321', 'localhost:54321'].filter((h) => source.includes(h));

if (localhost.length) {
  console.error(`\nThe bundle contains ${localhost.join(' and ')}. Refusing to ship it.`);
  process.exit(1);
}

console.log(`\nbundle points at ${expectedHost}, and carries no local address`);
