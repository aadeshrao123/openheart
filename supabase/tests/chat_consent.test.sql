-- OpenHeart :: explicit language by agreement
--   run with:  supabase test db
--
-- The feature is entirely about who may do what, so these are written from the
-- outside: the wrong person tries the thing and proves they cannot.
--
-- Two properties matter more than the rest and are asserted twice over. Nobody
-- can agree with themselves, and a slur is refused with the agreement in place,
-- because an agreement about explicit language is not one about abuse.

begin;
select plan(27);

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

insert into matches (id, user_a, user_b) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-1111-1111-111111111111',
   '22222222-2222-2222-2222-222222222222'),
  -- A second conversation Ana is also in, so "scoped to one conversation" is
  -- asserted against a real one rather than against an id that does not exist.
  ('aaaaaaaa-0000-4000-8000-000000000002',
   '11111111-1111-1111-1111-111111111111',
   '33333333-3333-3333-3333-333333333333');

create or replace function be(who uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'role', 'authenticated')::text, true);
end;
$$;

-- the default -----------------------------------------------------------------

select be('11111111-1111-1111-1111-111111111111');

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'send nudes') $$,
  '22000', null,
  'an explicit message is refused before anyone has agreed'
);

select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'hey, this weather is shit') $$,
  'mild swearing is not what this is about'
);

-- Swapping numbers after matching is ordinary, and 0025 deliberately left it
-- alone in messages. Nothing here changes that.
select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'my number is 07700 900123') $$,
  'contact details are still fine in a message'
);

-- who may ask ------------------------------------------------------------------

select throws_ok(
  $$ select request_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null,
  'somebody outside the conversation cannot ask'
) from (select be('33333333-3333-3333-3333-333333333333')) as _;

select be('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select request_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'a participant can ask'
);

select is(
  (select state::text from explicit_consent
    where match_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'requested',
  'asking records a request and nothing more'
);

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '11111111-1111-1111-1111-111111111111', 'send nudes') $$,
  '22000', null,
  'asking on its own changes nothing'
);

select lives_ok(
  $$ select request_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'asking twice is a no-op rather than an error'
);

-- THE ONE THAT MATTERS. If this ever passes, the feature is one person deciding
-- for two, which is the exact thing it exists to prevent.
select throws_ok(
  $$ select respond_to_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  '42501', null,
  'you cannot answer your own request'
);

select throws_ok(
  $$ select respond_to_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  '42501', null,
  'and a stranger cannot answer it either'
) from (select be('33333333-3333-3333-3333-333333333333')) as _;

-- agreeing ---------------------------------------------------------------------

select be('22222222-2222-2222-2222-222222222222');
select lives_ok(
  $$ select respond_to_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  'the other person can agree'
);

select lives_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '22222222-2222-2222-2222-222222222222', 'send nudes') $$,
  'explicit language is allowed once both agreed'
);

-- THE OTHER ONE THAT MATTERS. Consent to explicit language is not consent to
-- being abused, and no agreement between two people unlocks a slur.
select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '22222222-2222-2222-2222-222222222222', 'you are a retard') $$,
  '22000', null,
  'a slur is still refused with the agreement in place'
);

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '22222222-2222-2222-2222-222222222222', 'r3t4rd') $$,
  '22000', null,
  'and refused when it is padded out'
);

-- Scoped to one conversation, which is the whole point of it being per match.
-- Ana agreed with Ben; that says nothing about Ana and Cleo.
select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000002',
             '11111111-1111-1111-1111-111111111111', 'send nudes') $$,
  '22000', null,
  'the agreement does not reach another conversation'
) from (select be('11111111-1111-1111-1111-111111111111')) as _;

select be('22222222-2222-2222-2222-222222222222');

-- the table itself -------------------------------------------------------------

select be('33333333-3333-3333-3333-333333333333');
select is(
  (select count(*) from explicit_consent)::int, 0,
  'somebody outside the conversation reads none of it'
);

select throws_ok(
  $$ update explicit_consent set state = 'active'
      where match_id = 'aaaaaaaa-0000-4000-8000-000000000001' $$,
  null, null,
  'nobody has an update grant on the row, so it cannot be forged'
);

-- withdrawing ------------------------------------------------------------------
-- Alone and at once. Needing the other person to agree to stop is what makes
-- withdrawal impossible in practice.

select be('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select revoke_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'either side can withdraw without the other'
);

select throws_ok(
  $$ insert into messages (match_id, sender_id, body)
     values ('aaaaaaaa-0000-4000-8000-000000000001',
             '22222222-2222-2222-2222-222222222222', 'send nudes') $$,
  '22000', null,
  'and the next explicit message is refused again'
);

-- Ana withdrew, so it is Ana's to reopen and Ben cannot press the point.
select throws_ok(
  $$ select request_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null,
  'the other person cannot ask again after a withdrawal'
) from (select be('22222222-2222-2222-2222-222222222222')) as _;

select be('11111111-1111-1111-1111-111111111111');
select lives_ok(
  $$ select request_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'whoever ended it can open it again'
);

-- Taking back a question nobody answered is a cancellation, not a refusal.
-- Recording it as a refusal would lock out the person who never got to answer.
select lives_ok(
  $$ select revoke_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'you can take back your own unanswered request'
);

select is(
  (select settled_by from explicit_consent
    where match_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  null,
  'withdrawing your own question records nobody as having refused'
);

select throws_ok(
  $$ select respond_to_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001', true) $$,
  '42704', null,
  'and there is nothing left for the other person to answer'
) from (select be('22222222-2222-2222-2222-222222222222')) as _;

select lives_ok(
  $$ select request_explicit_consent('aaaaaaaa-0000-4000-8000-000000000001') $$,
  'the person who was never asked can now ask themselves'
);

-- realtime ---------------------------------------------------------------------
-- A table missing from the publication produces no error anywhere. The
-- subscription simply never fires and the app looks like it has a client bug.

select is(
  (select count(*)::int from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'explicit_consent'),
  1,
  'explicit_consent publishes changes, or a request never reaches the other side'
);

-- security definer reads past RLS, and a new function is executable by public
-- unless that is taken away. With the grant left in place this answers "have
-- those two agreed" for any match id, to anybody who asks.
select is(
  (select count(*) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'explicit_allowed'
      and has_function_privilege('authenticated', p.oid, 'execute'))::int,
  0,
  'the predicate that reads past RLS is not callable by a signed-in user'
);

select * from finish();
rollback;
