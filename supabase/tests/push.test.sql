-- OpenHeart :: sending push notifications
--   run with:  supabase test db
--
-- pg_net queues into net.http_request_queue before its worker drains it, and
-- this test never commits, so the request is asserted on and then thrown away.
-- Nothing here reaches Expo.
--
-- The property that matters most is the one asserted first: with no secrets
-- configured, sending a message still works. A notification that cannot be
-- sent must never be able to fail the write that prompted it.

begin;
select plan(21);

insert into auth.users (id, instance_id, aud, role, email) values
  ('11111111-1111-1111-1111-111111111111',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev'),
  ('22222222-2222-2222-2222-222222222222',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ben@test.dev'),
  ('33333333-3333-3333-3333-333333333333',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'cleo@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified) values
  ('11111111-1111-1111-1111-111111111111', 'Ana',  '1995-01-01', true),
  ('22222222-2222-2222-2222-222222222222', 'Ben',  '1994-01-01', true),
  ('33333333-3333-3333-3333-333333333333', 'Cleo', '1993-01-01', true);

-- Before any secret exists, so the match trigger below is exercised in the
-- configuration every environment starts in.
insert into matches (id, user_a, user_b) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222');

-- failing open ----------------------------------------------------------------

select is(
  (select count(*)::int from net.http_request_queue), 0,
  'with no secrets configured, a new match queues nothing'
);

select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'hello there') $$,
  'and a message still sends, which is the whole point of failing open'
);

select is(
  (select count(*)::int from net.http_request_queue), 0,
  'still nothing queued'
);

-- configured ------------------------------------------------------------------

-- Read, so the coalescing rule below starts from a clean conversation. Leaving
-- it unread is a real state and it is asserted on further down; it is just not
-- what the next few assertions are about.
update messages set read_at = now()
 where match_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select vault.create_secret('https://example.test/functions/v1/send-push', 'push_function_url');
select vault.create_secret('a-shared-secret', 'push_hook_secret');
select vault.create_secret('an-anon-key', 'push_function_anon_key');

select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'and another') $$,
  'a message into an open conversation'
);

select is(
  (select count(*)::int from net.http_request_queue), 1,
  'queues exactly one notification'
);

select is(
  (select convert_from(body, 'utf8')::jsonb ->> 'recipient' from net.http_request_queue),
  '22222222-2222-2222-2222-222222222222',
  'aimed at the person who did not send it'
);

select is(
  (select convert_from(body, 'utf8')::jsonb ->> 'kind' from net.http_request_queue),
  'message',
  'and says only that it was a message'
);

-- THE ONE THAT MATTERS. 0019 requires it: a token proves possession of a
-- device, and if that is ever wrong the consequence has to be a misrouted
-- notification rather than a leaked conversation.
select is(
  (select position('and another' in convert_from(body, 'utf8')) from net.http_request_queue),
  0,
  'and carries not one word of what was written'
);

select is(
  (select headers ->> 'X-Push-Secret' from net.http_request_queue),
  'a-shared-secret',
  'authenticated with the shared secret rather than a user JWT'
);

-- The header the function does not check and the request cannot arrive without.
-- 0029 omitted it and every notification came back UNAUTHORIZED_NO_AUTH_HEADER
-- from the Edge Function gateway, which sits in front of the function and which
-- nothing local has. This assertion is the only place that difference is
-- visible from a test.
select is(
  (select headers ->> 'Authorization' from net.http_request_queue),
  'Bearer an-anon-key',
  'and carries the bearer token the gateway refuses the request without'
);

-- one per conversation, not one per message ------------------------------------
--
-- The queue already holds the notification for 'and another', which nobody has
-- read. Everything Ana says next is covered by the notification already sitting
-- on Ben's lock screen.

select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'still there?'),
            ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'hello?'),
            ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'anyone?') $$,
  'three more messages into the same unread conversation'
);

select is(
  (select count(*)::int from net.http_request_queue), 1,
  'and the phone is still buzzed exactly once, not four times'
);

-- Once it is read, the next message is news again.
update messages set read_at = now()
 where match_id = 'aaaaaaaa-0000-4000-8000-000000000001'
   and sender_id = '11111111-1111-1111-1111-111111111111';

select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'there you are') $$,
  'a message after they caught up'
);

select is(
  (select count(*)::int from net.http_request_queue), 2,
  'notifies again, because the last one is no longer on their screen'
);

-- The hole the unread-only rule left. A notification that never arrived would
-- otherwise silence the conversation permanently, because every later message
-- sees an unread one and assumes it did its job.
delete from net.http_request_queue;

update messages
   set read_at = null, created_at = now() - interval '2 hours'
 where match_id = 'aaaaaaaa-0000-4000-8000-000000000001';

select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'are you there') $$,
  'a message hours after an unread one nobody was told about'
);

select is(
  (select count(*)::int from net.http_request_queue), 1,
  'notifies, rather than staying silent for ever on a notification that got lost'
);

-- who does not get notified ----------------------------------------------------

delete from net.http_request_queue;

insert into blocks (blocker_id, blocked_id) values
  ('22222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111');

-- The block trigger closes the match, so this also covers a closed one.
select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'let me back in') $$,
  'a message into a blocked conversation is not rejected here'
);

select is(
  (select count(*)::int from net.http_request_queue), 0,
  'but it notifies nobody'
);

-- a match ----------------------------------------------------------------------

delete from net.http_request_queue;

insert into matches (id, user_a, user_b) values
  ('aaaaaaaa-0000-4000-8000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333');

select is(
  (select count(*)::int from net.http_request_queue), 2,
  'a match notifies both people, because it is news to both of them'
);

-- the token ---------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select lives_ok(
  $$ select register_push_token('ExponentPushToken[test]', 'android', 'pt-BR') $$,
  'a device registers with the locale the server will write in'
);

select is(
  (select locale from push_tokens where token = 'ExponentPushToken[test]'),
  'pt-BR',
  'and the locale is stored, or every notification arrives in English'
);

select * from finish();
rollback;
