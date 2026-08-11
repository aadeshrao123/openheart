-- OpenHeart :: chat tests
--   run with:  supabase test db
--
-- Messages are the most personal thing in the product and reactions carry the
-- same exposure, so every assertion here is written from the outside: a user
-- who is not in a conversation proves they get nothing, rather than a
-- participant proving they get something.
--
-- The realtime assertions at the end exist because a table missing from the
-- publication produces no error anywhere. Subscriptions simply never fire, and
-- the app looks like it has a client bug.

begin;
select plan(25);

-- fixtures -------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'ben@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'cleo@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified) values
  ('11111111-1111-1111-1111-111111111111', 'Ana',  '1995-01-01', true),
  ('22222222-2222-2222-2222-222222222222', 'Ben',  '1994-01-01', true),
  ('33333333-3333-3333-3333-333333333333', 'Cleo', '1993-01-01', true);

insert into matches (id, user_a, user_b) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222');

insert into messages (id, match_id, sender_id, body) values
  ('bbbbbbbb-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'from ana'),
  ('bbbbbbbb-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'from ben');

insert into message_reactions (message_id, user_id, reaction) values
  ('bbbbbbbb-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'love');

-- Cleo is matched with nobody -------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "33333333-3333-3333-3333-333333333333",
  "role": "authenticated"
}';

select is(
  (select count(*) from messages)::int, 0,
  'a user outside a match reads none of its messages'
);

select is(
  (select count(*) from message_reactions)::int, 0,
  'a user outside a match reads none of its reactions'
);

select is(
  (select count(*) from list_threads())::int, 0,
  'list_threads returns nothing for a user with no matches'
);

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '33333333-3333-3333-3333-333333333333', 'let me in') $$,
  null,
  'a user cannot post into a match they are not part of'
);

select throws_ok(
  $$ insert into message_reactions (message_id, user_id, reaction)
     values ('bbbbbbbb-0000-4000-8000-000000000001',
             '33333333-3333-3333-3333-333333333333', 'laugh') $$,
  null,
  'a user cannot react to a message in a conversation they are not part of'
);

select throws_ok(
  $$ select mark_thread_read('aaaaaaaa-0000-4000-8000-000000000001') $$,
  null,
  'a user cannot mark a conversation read that is not theirs'
);

select throws_ok(
  $$ select unsend_message('bbbbbbbb-0000-4000-8000-000000000001') $$,
  null,
  'a user cannot unsend a message they did not send'
);

-- Ben is the recipient of message one ----------------------------------------
set local request.jwt.claims = '{
  "sub": "22222222-2222-2222-2222-222222222222",
  "role": "authenticated"
}';

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'forged') $$,
  null,
  'a user cannot post a message as somebody else'
);

select throws_ok(
  $$ update messages set read_at = now()
      where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  null,
  'receipts are not client-writable: messages carry no update grant'
);

select throws_ok(
  $$ insert into message_reactions (message_id, user_id, reaction)
     values ('bbbbbbbb-0000-4000-8000-000000000002',
             '11111111-1111-1111-1111-111111111111', 'fire') $$,
  null,
  'a user cannot react as somebody else'
);

select is(
  (select unread_count from list_threads())::int, 1,
  'list_threads counts only the messages the caller has not read'
);

select lives_ok(
  $$ select mark_thread_read('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'a participant can mark their conversation read'
);

select isnt(
  (select read_at from messages where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  null,
  'reading a thread marks the messages the caller received'
);

select is(
  (select read_at from messages where id = 'bbbbbbbb-0000-4000-8000-000000000002'),
  null,
  'reading a thread never marks the caller own messages as read'
);

-- Clearing a reaction is an update, never a delete, because realtime does not
-- apply RLS to delete events.
select lives_ok(
  $$ update message_reactions set reaction = null
      where message_id = 'bbbbbbbb-0000-4000-8000-000000000001'
        and user_id = '22222222-2222-2222-2222-222222222222' $$,
  'a user can clear their own reaction'
);

select is(
  (select count(*) from message_reactions)::int, 1,
  'clearing a reaction keeps the row so no unauthorized delete event is emitted'
);

select throws_ok(
  $$ delete from message_reactions
      where message_id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  null,
  'reactions carry no delete grant'
);

select lives_ok(
  $$ select set_reaction('bbbbbbbb-0000-4000-8000-000000000001', 'fire') $$,
  'set_reaction replaces an existing reaction without a delete'
);

select is(
  (select reaction from message_reactions
    where message_id = 'bbbbbbbb-0000-4000-8000-000000000001'
      and user_id = '22222222-2222-2222-2222-222222222222'),
  'fire',
  'set_reaction updates only the reaction column'
);

-- Ana sent message one, and Ben has now read it -------------------------------
set local request.jwt.claims = '{
  "sub": "11111111-1111-1111-1111-111111111111",
  "role": "authenticated"
}';

select throws_ok(
  $$ select unsend_message('bbbbbbbb-0000-4000-8000-000000000001') $$,
  '55000',
  'message has already been read',
  'a message cannot be unsent once the other person has read it'
);

-- Planted as the table owner: `id` is deliberately absent from the insert
-- grant, so a client cannot choose a message id and this fixture cannot use
-- the client path to pick one either.
reset role;

insert into messages (id, match_id, sender_id, body) values
  ('bbbbbbbb-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111', 'sent too soon');

set local role authenticated;

select unsend_message('bbbbbbbb-0000-4000-8000-000000000003');

select is(
  (select body from messages where id = 'bbbbbbbb-0000-4000-8000-000000000003'),
  '',
  'unsending clears the body rather than deleting the row'
);

select is(
  (select count(*) from list_threads())::int, 1,
  'a thread is listed for both participants'
);

insert into hidden_matches (match_id, user_id) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111');

select is(
  (select count(*) from list_threads())::int, 0,
  'hiding a thread removes it for the hider only'
);

-- Rate limit. The second half of the swipes-and-messages non-negotiable, and
-- the thing that stops one compromised account from flooding every match it
-- has. Ana has sent two, so 298 more puts her exactly on the limit.
insert into messages (match_id, sender_id, body)
select 'aaaaaaaa-0000-4000-8000-000000000001',
       '11111111-1111-1111-1111-111111111111',
       'flood ' || n
  from generate_series(1, 298) as n;

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'over the limit') $$,
  '53400',
  'message rate limit exceeded',
  'the message rate limit refuses a sender past 300 in an hour'
);

-- Realtime. A table absent from the publication produces no error and no
-- events, which reads as a broken client rather than a missing migration.
reset role;

select is(
  (select count(*) from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename in ('messages', 'message_reactions'))::int,
  2,
  'messages and reactions are published to realtime'
);

select * from finish();
rollback;
