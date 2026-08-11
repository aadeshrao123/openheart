// Sets up a complete, signed-in-able local environment so the app can be walked
// through end to end without clicking anything to get there.
//
// Local only, and it says so loudly. It writes photo_verified through psql,
// which no client role can do and the service role is tested as unable to do.
//
//   node scripts/dev-fixture.mjs
//   node scripts/dev-fixture.mjs --count 25
//   node scripts/dev-fixture.mjs --code --email ava@test.dev
//
// It is idempotent: run it again and you get a clean deck and fresh accounts.

import { execFileSync } from 'node:child_process';
import { argv, exit } from 'node:process';

const DB = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const API = 'http://127.0.0.1:54321';
const MAILPIT = 'http://127.0.0.1:54324';

// Central London. The seed scatters candidates around whatever this is, and the
// fixture accounts are placed at exactly the same point so they are all in range.
const LAT = 51.5074;
const LON = -0.1278;

const SOLO_EMAIL = 'dev@test.dev';

// Three, not two, so a conversation can be checked against a third account that
// is matched but silent.
const PEOPLE = [
  {
    email: 'ava@test.dev',
    display_name: 'Ava',
    birthdate: '1996-03-14',
    gender: 'woman',
    bio: 'Test account. Ava is matched with Ben and with Cleo.',
  },
  {
    email: 'ben@test.dev',
    display_name: 'Ben',
    birthdate: '1993-11-02',
    gender: 'man',
    bio: 'Test account. Ben has already sent Ava a message.',
  },
  {
    email: 'cleo@test.dev',
    display_name: 'Cleo',
    birthdate: '1998-07-21',
    gender: 'nonbinary',
    bio: 'Test account. Cleo is matched with both of the others.',
  },
];

const OPENING_MESSAGE = 'Hey, your bio made me laugh. What are you up to this weekend?';

function arg(name, fallback) {
  const index = argv.indexOf(`--${name}`);

  return index === -1 ? fallback : argv[index + 1];
}

const email = arg('email', SOLO_EMAIL);
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

async function signUp(address) {
  await fetch(`${MAILPIT}/api/v1/messages`, { method: 'DELETE' });

  await api('/auth/v1/otp', {
    method: 'POST',
    body: JSON.stringify({ email: address, create_user: true }),
  });

  const code = await readLatestCode();

  return api('/auth/v1/verify', {
    method: 'POST',
    body: JSON.stringify({ email: address, token: code, type: 'email' }),
  });
}

async function createProfile(session, fields) {
  await api('/rest/v1/profiles', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({
      id: session.user.id,
      seeking: ['woman', 'man', 'nonbinary'],
      location: `SRID=4326;POINT(${LON} ${LAT})`,
      max_distance_km: 50,
      age_min: 18,
      age_max: 99,
      ...fields,
    }),
  });
}

// Through the swipe trigger rather than a direct insert, so the fixture
// exercises the same path a real match takes.
function matchThem(first, second) {
  psql(`insert into swipes (swiper_id, target_id, direction)
        values ('${first}', '${second}', 'like'), ('${second}', '${first}', 'like')
        on conflict do nothing;`);
}

async function main() {
  refuseIfNotLocal();
  anonKey = readAnonKey();

  const addresses = [SOLO_EMAIL, ...PEOPLE.map((person) => person.email)];

  console.log('Clearing the previous fixture...');
  psql(`delete from profiles where id::text like 'deadbeef-%';
        delete from auth.users where id::text like 'deadbeef-%';
        delete from profiles where id in (
          select id from auth.users where email in (${addresses.map((a) => `'${a}'`).join(', ')})
        );
        delete from auth.users
         where email in (${addresses.map((a) => `'${a}'`).join(', ')});`);

  console.log(`Seeding ${count} candidates around ${LAT}, ${LON}...`);
  execFileSync(
    'psql',
    [DB, '-v', 'ON_ERROR_STOP=1', '-v', `lat=${LAT}`, '-v', `lon=${LON}`,
      '-v', `count=${count}`, '-f', 'supabase/dev-seed/seed.sql'],
    { encoding: 'utf8' },
  );

  console.log(`Creating ${SOLO_EMAIL} for the deck...`);
  const solo = await signUp(SOLO_EMAIL);

  await createProfile(solo, {
    display_name: 'Dev Tester',
    birthdate: '1994-05-05',
    gender: 'woman',
    bio: 'The fixture account. Swipe right on the first two to see a match.',
  });

  // Two candidates already like the fixture account, so a right swipe on either
  // produces a match immediately rather than needing a second device.
  const likers = ['deadbeef-0000-4000-8000-000000000001', 'deadbeef-0000-4000-8000-000000000002'];

  psql(`insert into swipes (swiper_id, target_id, direction)
        values ${likers.map((id) => `('${id}', '${solo.user.id}', 'like')`).join(', ')}
        on conflict do nothing;`);

  console.log('Creating the three chat accounts...');
  const people = [];

  for (const person of PEOPLE) {
    const session = await signUp(person.email);
    const { email: address, ...fields } = person;

    await createProfile(session, fields);
    people.push({ ...person, id: session.user.id });
  }

  const ids = people.map((person) => `'${person.id}'`).join(', ');

  psql(`update profiles set photo_verified = true where id in (${ids});`);

  const [ava, ben, cleo] = people;

  matchThem(ava.id, ben.id);
  matchThem(ava.id, cleo.id);
  matchThem(ben.id, cleo.id);

  // One unread inbound message, so the receipt ticks and the reaction sheet
  // both have something to act on the moment Ava signs in.
  psql(`insert into messages (match_id, sender_id, body)
        select m.id, '${ben.id}', '${OPENING_MESSAGE}'
          from matches m
         where m.user_a = least('${ava.id}'::uuid, '${ben.id}'::uuid)
           and m.user_b = greatest('${ava.id}'::uuid, '${ben.id}'::uuid);`);

  const candidates = psql(
    `select count(*) from profiles where id::text like 'deadbeef-%' and photo_verified;`,
  );

  console.log('');
  console.log('Ready.');
  console.log(`  candidates in the deck : ${candidates}`);
  console.log('  deck account           : dev@test.dev (Test Profile 1 and 2 already like it)');
  console.log('  chat accounts          : ava@test.dev, ben@test.dev, cleo@test.dev');
  console.log('  all three are matched with each other; Ben has messaged Ava');
  console.log('');
  console.log('  1. npx expo start, then press w');
  console.log('  2. Open a second browser window in private mode for the other account');
  console.log('  3. Sign in as ava@test.dev in one and ben@test.dev in the other');
  console.log('  4. Get a code with: node scripts/dev-fixture.mjs --code --email ava@test.dev');
  console.log('');
  console.log('Two windows, because a session is per browser profile. Signing in as the');
  console.log('second account in the same window signs the first one out.');
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
