-- OpenHeart :: safety and moderation tests
--   run with:  supabase test db
--
-- The first block exists because the behaviour it asserts was broken until
-- 0014: blocking someone you were already matched with left them able to
-- message you. Everything else here is written the same way round, proving the
-- person who should be shut out is shut out rather than proving the moderator
-- can do their job.

begin;
select plan(23);

-- fixtures -------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@test.dev'),
  ('22222222-2222-2222-2222-222222222222', 'ben@test.dev'),
  ('33333333-3333-3333-3333-333333333333', 'cleo@test.dev'),
  ('44444444-4444-4444-4444-444444444444', 'dave@test.dev');

insert into profiles (id, display_name, birthdate, photo_verified) values
  ('11111111-1111-1111-1111-111111111111', 'Ana',  '1995-01-01', true),
  ('22222222-2222-2222-2222-222222222222', 'Ben',  '1994-01-01', true),
  ('33333333-3333-3333-3333-333333333333', 'Cleo', '1993-01-01', true),
  ('44444444-4444-4444-4444-444444444444', 'Dave', '1992-01-01', true);

insert into matches (id, user_a, user_b) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222'),
  ('aaaaaaaa-0000-4000-8000-000000000002',
   '22222222-2222-2222-2222-222222222222',
   '44444444-4444-4444-4444-444444444444');

insert into messages (match_id, sender_id, body) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '22222222-2222-2222-2222-222222222222', 'said before the block');

insert into reports (reporter_id, target_id, reason, detail) values
  ('11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222', 'harassment', 'kept going after no');

-- Ana blocks Ben.
insert into blocks (blocker_id, blocked_id) values
  ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Ben, who has just been blocked and does not know it ------------------------
set local role authenticated;
set local request.jwt.claims = '{
  "sub": "22222222-2222-2222-2222-222222222222",
  "role": "authenticated"
}';

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '22222222-2222-2222-2222-222222222222', 'still here') $$,
  null,
  'a blocked user cannot send another message into the conversation'
);

select is(
  (select unmatched_by from matches where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'blocking closes the match, and looks exactly like an unmatch from this side'
);

select is(
  (select count(*) from messages
    where match_id = 'aaaaaaaa-0000-4000-8000-000000000001')::int,
  1,
  'a blocked user keeps the history, which is their conversation too'
);

select is(
  (select count(*) from blocks)::int, 0,
  'a blocked user cannot see that they were blocked'
);

select throws_ok(
  $$ update matches set unmatched_by = null
      where id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  null,
  'a blocked user cannot reopen the match by clearing unmatched_by'
);

select is(
  (select count(*) from reports)::int, 0,
  'a reported user cannot see that they were reported'
);

-- Ana, who filed the report --------------------------------------------------
set local request.jwt.claims = '{
  "sub": "11111111-1111-1111-1111-111111111111",
  "role": "authenticated"
}';

select is(
  (select count(*) from reports)::int, 0,
  'even the reporter cannot read reports back'
);

select is(
  (select count(*) from list_reports())::int, 0,
  'list_reports returns nothing to someone who is not a moderator'
);

select throws_ok(
  $$ select resolve_report(
       (select id from reports limit 1), 'dismissed', null, false) $$,
  null,
  'a user cannot resolve a report'
);

select throws_ok(
  $$ select lift_suspension('22222222-2222-2222-2222-222222222222') $$,
  null,
  'a user cannot lift a suspension'
);

select throws_ok(
  $$ update reports set status = 'dismissed' $$,
  null,
  'reports carry no update grant, so a verdict cannot be written directly'
);

select throws_ok(
  $$ update profiles set suspended_at = null
      where id = '11111111-1111-1111-1111-111111111111' $$,
  null,
  'suspended_at is not client-writable'
);

-- Ana already filed one report, so nineteen more put her on the limit.
insert into reports (reporter_id, target_id, reason)
select '11111111-1111-1111-1111-111111111111',
       '33333333-3333-3333-3333-333333333333',
       'spam'
  from generate_series(1, 19);

select throws_ok(
  $$ insert into reports (reporter_id, target_id, reason)
     values ('11111111-1111-1111-1111-111111111111',
             '44444444-4444-4444-4444-444444444444', 'spam') $$,
  '53400',
  'report rate limit exceeded',
  'mass reporting is refused, because it is itself a harassment tool'
);

-- Cleo, a moderator ----------------------------------------------------------
set local request.jwt.claims = '{
  "sub": "33333333-3333-3333-3333-333333333333",
  "role": "authenticated",
  "app_metadata": { "moderator": true }
}';

select ok(
  (select count(*) from list_reports())::int >= 1,
  'a moderator sees the pending queue'
);

select is(
  (select target_name from list_reports()
    where target_id = '22222222-2222-2222-2222-222222222222' limit 1),
  'Ben',
  'the queue carries the reported name so a human can act on it'
);

select is(
  (select target_reports from list_reports()
    where target_id = '22222222-2222-2222-2222-222222222222' limit 1)::int,
  1,
  'the queue counts how many reports name the same person'
);

select throws_ok(
  $$ select resolve_report(
       (select id from reports
         where target_id = '22222222-2222-2222-2222-222222222222' limit 1),
       'pending', null, false) $$,
  '22023',
  'a resolution cannot leave the report pending',
  'resolving a report has to actually resolve it'
);

select lives_ok(
  $$ select resolve_report(
       (select id from reports
         where target_id = '22222222-2222-2222-2222-222222222222' limit 1),
       'actioned', 'suspended for harassment', true) $$,
  'a moderator can action a report and suspend in one call'
);

select is(
  (select target_suspended from list_reports(true)
    where target_id = '22222222-2222-2222-2222-222222222222' limit 1),
  true,
  'actioning with suspend set actually suspends the reported account'
);

-- Suspending sets is_active false, and profiles_select_others needs is_active,
-- so a moderator loses the ordinary read on the person they just suspended.
-- The queue is a security definer function precisely so it keeps working.
select is(
  (select count(*) from profiles
    where id = '22222222-2222-2222-2222-222222222222')::int,
  0,
  'a moderator cannot read a suspended profile directly, only through the queue'
);

-- Ben again, now suspended ---------------------------------------------------
set local request.jwt.claims = '{
  "sub": "22222222-2222-2222-2222-222222222222",
  "role": "authenticated"
}';

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000002',
             '22222222-2222-2222-2222-222222222222', 'hello from a ban') $$,
  null,
  'a suspended user cannot message anyone, including untouched matches'
);

select throws_ok(
  $$ update profiles set is_active = true
      where id = '22222222-2222-2222-2222-222222222222' $$,
  '55000',
  'a suspended profile cannot be reactivated',
  'a suspended user cannot reactivate themselves back into the deck'
);

-- Dave, who was matched with Ben ---------------------------------------------
set local request.jwt.claims = '{
  "sub": "44444444-4444-4444-4444-444444444444",
  "role": "authenticated"
}';

select is(
  (select count(*) from profiles
    where id = '22222222-2222-2222-2222-222222222222'
      and is_active)::int,
  0,
  'a suspended profile is no longer active anywhere it is looked up'
);

select * from finish();
rollback;
