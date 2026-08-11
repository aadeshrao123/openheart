// Sets up a complete, signed-in-able local environment so the app can be walked
// through end to end without clicking anything to get there.
//
// Local only, and it says so loudly. It writes photo_verified through psql,
// which no client role can do and the service role is tested as unable to do.
//
//   node scripts/dev-fixture.mjs
//   node scripts/dev-fixture.mjs --email me@test.dev --count 25
//
// It is idempotent: run it again and you get a clean deck and a fresh code.

import { execFileSync } from 'node:child_process';
import { argv, exit } from 'node:process';

const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const API = 'http://127.0.0.1:54321';
const MAILPIT = 'http://127.0.0.1:54324';

// Central London. The seed scatters candidates around whatever this is, and the
// fixture account is placed at exactly the same point so they are all in range.
const LAT = 51.5074;
const LON = -0.1278;

function arg(name, fallback) {
  const index = argv.indexOf(`--${name}`);

  return index === -1 ? fallback : argv[index + 1];
}

const email = arg('email', 'dev@test.dev');
const count = Number(arg('count', '25'));

function psql(sql) {
  return execFileSync('psql', [DB, '-tAc', sql], { encoding: 'utf8' }).trim();
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { apikey: anonKey, 'Content-Type': 'application/json', ...options.headers },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new Error(`${path} -> ${response.status} ${text.slice(0, 200)}`);
  }

  return body;
}

function refuseIfNotLocal() {
  // The same blind spot the benchmark seed documents: nothing reachable from
  // SQL reliably says "this is production". This checks the only thing that
  // does, which is that the connection is to localhost.
  if (!DB.includes('127.0.0.1')) {
    console.error('Refusing to run against anything but a local database.');
    exit(1);
  }
}

let anonKey;

function readAnonKey() {
  const status = execFileSync('supabase', ['status', '-o', 'json'], { encoding: 'utf8' });

  return JSON.parse(status.slice(status.indexOf('{'))).ANON_KEY;
}

async function main() {
  refuseIfNotLocal();
  anonKey = readAnonKey();

  console.log('Clearing the previous fixture...');
  psql(`delete from profiles where id::text like 'deadbeef-%';
        delete from auth.users where id::text like 'deadbeef-%';
        delete from profiles where id in (select id from auth.users where email = '${email}');
        delete from auth.users where email = '${email}';`);

  console.log(`Seeding ${count} candidates around ${LAT}, ${LON}...`);
  execFileSync(
    'psql',
    [DB, '-v', 'ON_ERROR_STOP=1', '-v', `lat=${LAT}`, '-v', `lon=${LON}`,
      '-v', `count=${count}`, '-f', 'supabase/dev-seed/seed.sql'],
    { encoding: 'utf8' },
  );

  console.log(`Creating ${email} with a profile at the same spot...`);
  await api('/auth/v1/otp', {
    method: 'POST',
    body: JSON.stringify({ email, create_user: true }),
  });

  const code = await readLatestCode();
  const session = await api('/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ email, token: code, type: 'email' }),
  });

  const userId = session.user.id;

  await api('/rest/v1/profiles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      id: userId,
      display_name: 'Dev Tester',
      birthdate: '1994-05-05',
      bio: 'The fixture account. Swipe right on the first two to see a match.',
      gender: 'woman',
      seeking: ['woman', 'man', 'nonbinary'],
      location: `SRID=4326;POINT(${LON} ${LAT})`,
      max_distance_km: 50,
      age_min: 18,
      age_max: 99,
    }),
  });

  // Two candidates already like the fixture account, so a right swipe on either
  // produces a match immediately rather than needing a second device.
  const likers = ['deadbeef-0000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000002'];

  psql(`insert into swipes (swiper_id, target_id, direction)
        values ${likers.map((id) => `('${id}', '${userId}', 'like')`).join(', ')}
        on conflict do nothing;`);

  const candidates = psql(
    `select count(*) from profiles where id::text like 'deadbeef-%' and photo_verified;`,
  );

  console.log('');
  console.log('Ready.');
  console.log(`  candidates in the deck : ${candidates}`);
  console.log(`  already like you       : Test Profile 1, Test Profile 2`);
  console.log('');
  console.log('  1. npx expo start, then press w');
  console.log(`  2. Sign in as ${email}`);
  console.log('  3. Get the code with: node scripts/dev-fixture.mjs --code');
  console.log('');
  console.log('Clear it again with the same command, or see supabase/dev-seed/README.md.');
}

async function readLatestCode() {
  // Codes are only ever read from the local mail catcher. Nothing here can see
  // a real inbox.
  let lastSubject = null;

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const list = await (await fetch(`${MAILPIT}/api/v1/messages?limit=1`)).json();

    if (list.messages?.length) {
      lastSubject = list.messages[0].Subject;

      const id = list.messages[0].ID;
      const message = await (await fetch(`${MAILPIT}/api/v1/message/${id}`)).json();
      const match = (message.Text ?? '').match(/\b\d{6}\b/);

      if (match) {
        return match[0];
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Naming the actual cause, because the generic version of this message sent
  // the last person looking at whether Supabase was running.
  if (lastSubject && !lastSubject.includes('code')) {
    throw new Error(
      `The email arrived as "${lastSubject}", which is the default template, not the code one.\n` +
        'supabase db reset restarts the containers but does not re-read config.toml.\n' +
        'Run: supabase stop && supabase start',
    );
  }

  throw new Error('No sign-in email arrived. Is supabase running?');
}

// A separate mode, because the code changes every time one is requested and the
// useful thing mid-session is "give me the current one".
async function printCode() {
  anonKey = readAnonKey();

  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });
  await api('/auth/v1/otp', {
    method: 'POST',
    body: JSON.stringify({ email, create_user: false }),
  });

  console.log(await readLatestCode());
}

const run = argv.includes('--code') ? printCode : main;

run().catch((error) => {
  console.error(String(error.message ?? error));
  exit(1);
});
