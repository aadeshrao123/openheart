-- OpenHeart :: written profile text, checked where a client cannot reach
--
-- lib/text-safety.ts refuses this text in the app, which is the fast half and
-- the half anybody can edit out. These assert the copy that actually holds: a
-- trigger, running inside the same statement as the write.
--
-- The false positives matter as much as the catches. Blocking somebody from
-- Scunthorpe is a worse outcome than missing one slur, because it lands on a
-- person who did nothing and gives them no way to argue.

begin;
select plan(22);

insert into auth.users (id, instance_id, aud, role, email) values
  ('aaaa0000-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ana@test.dev');

insert into profiles (id, display_name, birthdate) values
  ('aaaa0000-0000-0000-0000-000000000001', 'Ana', '1994-02-02');

-- the normaliser -------------------------------------------------------------

select is(normalise_for_safety('F4K3', false), 'fake', 'digits fold to letters');
select is(normalise_for_safety('heyyyyy', false), 'hey', 'repeats collapse');
select is(normalise_for_safety('h.e.l.l.o', false), 'helo', 'separators go, then repeats');
select is(normalise_for_safety('h.e.l.l.o', true), 'h.e.l.l.o', 'separators survive');
select is(gap_pattern('sex'), '\ys[^a-z0-9]*e[^a-z0-9]*x\y', 'a term becomes a gap pattern');

-- what passes ----------------------------------------------------------------

select is(text_safety_violation('I grew up in Scunthorpe'), null, 'place names pass');
select is(text_safety_violation('Analyst, class of 2018'), null, 'substrings pass');
select is(text_safety_violation('Climber and terrible cook'), null, 'ordinary text passes');
select is(text_safety_violation(''), null, 'empty passes');
select is(text_safety_violation(null), null, 'null passes');

-- what does not --------------------------------------------------------------

select is(text_safety_violation('mail me at a@b.co'), 'contact', 'an email is contact');
select is(text_safety_violation('add me on telegram'), 'contact', 'another app is contact');
select is(text_safety_violation('my rates on onlyfans'), 'solicitation', 'paid is solicitation');
select is(text_safety_violation('r3t4rd'), 'slur', 'a padded slur is still a slur');
select is(text_safety_violation('send nudes'), 'sexual', 'explicit words are refused');
select is(text_safety_violation('d.i.c.k'), 'sexual', 'and refused when spelled out');
select is(text_safety_violation('this weather is shit'), null, 'mild swearing passes');
select is(text_safety_violation('open issue on my repo'), null, 'open issue is not penis');
select is(text_safety_violation('I am bisexual'), null, 'bisexual is not sex');

-- and the trigger, which is the point ----------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"aaaa0000-0000-0000-0000-000000000001","role":"authenticated"}';

select throws_ok(
  $$update profiles set bio = 'reach me at someone@example.com'
    where id = 'aaaa0000-0000-0000-0000-000000000001'$$,
  '22000',
  null,
  'a bio carrying an email is refused by the database'
);

select throws_ok(
  $$update profiles set display_name = 'r e t a r d'
    where id = 'aaaa0000-0000-0000-0000-000000000001'$$,
  '22000',
  null,
  'a spaced slur in a display name is refused'
);

select lives_ok(
  $$update profiles set bio = 'Climber, terrible cook, from Scunthorpe'
    where id = 'aaaa0000-0000-0000-0000-000000000001'$$,
  'an ordinary bio is still accepted'
);

select * from finish();
rollback;
