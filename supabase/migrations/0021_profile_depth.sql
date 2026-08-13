-- OpenHeart :: the fields a profile needs to be worth reading
--
-- A profile was a name, an age, a bio and photos. That is a 2012 dating app.
-- Every current one carries height, intent, lifestyle, education and a set of
-- interests, and Hinge's prompts are the thing people actually open a
-- conversation with. All of it is free here, because a profile field behind a
-- payment is the exact shape this project refuses.
--
-- Every column is nullable. The schema is a public API and a shipped client
-- must survive a server that knows more than it does.
--
-- Values are stable identifiers, never shown to anyone. The label is looked up
-- through i18n, so translating one cannot change what is in the database.

-- ------------------------------------------------------------------ columns

alter table profiles
  add column if not exists height_cm smallint
    check (height_cm is null or height_cm between 120 and 250),

  add column if not exists relationship_intent text
    check (relationship_intent is null or relationship_intent in (
      'long_term', 'long_term_open_short', 'short_term_open_long',
      'short_term', 'friends', 'figuring_out'
    )),

  add column if not exists drinking text
    check (drinking is null or drinking in ('never', 'sometimes', 'often', 'prefer_not_say')),

  add column if not exists smoking text
    check (smoking is null or smoking in ('never', 'sometimes', 'often', 'prefer_not_say')),

  add column if not exists exercise text
    check (exercise is null or exercise in ('never', 'sometimes', 'often', 'prefer_not_say')),

  add column if not exists children text
    check (children is null or children in (
      'have_and_want_more', 'have_and_done', 'want_someday', 'do_not_want', 'not_sure'
    )),

  add column if not exists education text
    check (education is null or education in (
      'secondary', 'vocational', 'undergraduate', 'postgraduate', 'doctorate'
    )),

  add column if not exists job_title text
    check (job_title is null or length(trim(job_title)) between 1 and 60),

  add column if not exists languages text[]
    check (languages is null or (
      array_length(languages, 1) <= 6 and array_position(languages, null) is null
    )),

  -- An array rather than a join table. It is a bounded set with no attributes
  -- of its own, and a GIN index answers overlap queries for filtering later.
  add column if not exists interests text[]
    check (interests is null or (
      array_length(interests, 1) <= 8 and array_position(interests, null) is null
    ));

create index if not exists profiles_interests_idx on profiles using gin (interests);

-- ------------------------------------------------------------------ prompts
--
-- Three answered questions, which is what gives somebody an opening line.
--
-- The cap is the schema rather than a trigger: position is checked 0 to 2 and
-- unique per profile, so a fourth row has nowhere to go. The prompt is also
-- unique per profile, so the same question cannot be answered twice.

create table if not exists profile_prompts (
  profile_id uuid not null references profiles (id) on delete cascade,
  prompt     text not null check (length(prompt) between 1 and 40),
  answer     text not null check (length(trim(answer)) between 1 and 255),
  position   smallint not null check (position between 0 and 2),

  primary key (profile_id, prompt),
  unique (profile_id, position)
);

alter table profile_prompts enable row level security;

-- ------------------------------------------------------------------- grants

grant select (
  profile_id, prompt, answer, position
) on profile_prompts to authenticated;

grant insert (
  profile_id, prompt, answer, position
) on profile_prompts to authenticated;

grant update (prompt, answer, position) on profile_prompts to authenticated;
grant delete on profile_prompts to authenticated;

-- 0016 narrowed the profiles select grant to an explicit column list, so a new
-- column is invisible to every client until it is named here. This is the
-- fifth time in this project that half of a permission pair was added without
-- the other, and the only reason it is not the sixth is that the grant is in
-- the same migration as the columns.
--
-- birthdate, location, suspended_at and suspended_reason stay absent, for the
-- reasons 0016 gives.

grant select (
  height_cm, relationship_intent, drinking, smoking, exercise,
  children, education, job_title, languages, interests
) on public.profiles to authenticated;

grant insert (
  height_cm, relationship_intent, drinking, smoking, exercise,
  children, education, job_title, languages, interests
) on public.profiles to authenticated;

grant update (
  height_cm, relationship_intent, drinking, smoking, exercise,
  children, education, job_title, languages, interests
) on public.profiles to authenticated;

-- ----------------------------------------------------------------- policies
--
-- Readable exactly when the profile behind it is: not blocked either way, and
-- the account still active. Mirrors photos_select_others in 0002.

create policy prompts_select_others on profile_prompts
  for select to authenticated
  using (
    not public.is_blocked((select auth.uid()), profile_id)
    and exists (
      select 1
        from profiles p
       where p.id = profile_id
         and p.is_active
         and p.deleted_at is null
    )
  );

create policy prompts_select_own on profile_prompts
  for select to authenticated
  using ((select auth.uid()) = profile_id);

create policy prompts_insert_own on profile_prompts
  for insert to authenticated
  with check ((select auth.uid()) = profile_id);

create policy prompts_update_own on profile_prompts
  for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

create policy prompts_delete_own on profile_prompts
  for delete to authenticated
  using ((select auth.uid()) = profile_id);

-- --------------------------------------------------------------- deletion
--
-- delete_my_account clears the personal fields and keeps the row. These are
-- personal fields, so they go the same way, and the prompts are free text a
-- person wrote about themselves and go entirely.

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  insert into deleted_media (r2_key)
  select r2_key
    from photos
   where profile_id = me
  on conflict (r2_key) do nothing;

  delete from photos where profile_id = me;
  delete from profile_prompts where profile_id = me;
  delete from push_tokens where profile_id = me;

  update matches
     set unmatched_by = me
   where unmatched_by is null
     and me in (user_a, user_b);

  update profiles
     set display_name        = '',
         bio                 = null,
         gender              = null,
         seeking             = '{}',
         location            = null,
         birthdate           = null,
         is_active           = false,
         photo_verified      = false,
         height_cm           = null,
         relationship_intent = null,
         drinking            = null,
         smoking             = null,
         exercise            = null,
         children            = null,
         education           = null,
         job_title           = null,
         languages           = null,
         interests           = null,
         deleted_at          = now()
   where id = me;

  delete from auth.users where id = me;
end;
$$;

revoke all on function delete_my_account() from public;
grant execute on function delete_my_account() to authenticated;

-- --------------------------------------------------------------- discovery
--
-- The deck needs the new fields or none of this is visible where it matters.
-- Same authorization predicates as 0008, which are the only thing standing in
-- for RLS inside a security definer function. Do not drop one to save a join.

drop function if exists discover_profiles(int);

create function discover_profiles(page_size int default 20)
returns table (
  id                  uuid,
  display_name        text,
  bio                 text,
  gender              text,
  age                 int,
  distance_bucket_km  int,
  last_active         timestamptz,
  height_cm           smallint,
  relationship_intent text,
  drinking            text,
  smoking             text,
  exercise            text,
  children            text,
  education           text,
  job_title           text,
  languages           text[],
  interests           text[],
  prompts             jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select *
      from profiles
     where id = (select auth.uid())
       and deleted_at is null
  )
  select
    p.id,
    p.display_name,
    p.bio,
    p.gender,
    extract(year from age(p.birthdate))::int,
    (round((ST_Distance(p.location, me.location) / 1000.0) / 5) * 5)::int,
    p.last_active,
    p.height_cm,
    p.relationship_intent,
    p.drinking,
    p.smoking,
    p.exercise,
    p.children,
    p.education,
    p.job_title,
    p.languages,
    p.interests,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object('prompt', q.prompt, 'answer', q.answer)
                         order by q.position)
          from profile_prompts q
         where q.profile_id = p.id
      ),
      '[]'::jsonb
    )
  from profiles p, me
  where p.id <> me.id
    and p.is_active
    and p.deleted_at is null
    and p.photo_verified
    and not exists (
      select 1
        from blocks b
       where (b.blocker_id = me.id and b.blocked_id = p.id)
          or (b.blocker_id = p.id and b.blocked_id = me.id)
    )
    and ST_DWithin(p.location, me.location, me.max_distance_km * 1000)
    and p.birthdate <= (current_date - make_interval(years => me.age_min))
    and p.birthdate >  (current_date - make_interval(years => me.age_max + 1))
    and not exists (
      select 1
        from swipes s
       where s.swiper_id = me.id
         and s.target_id = p.id
    )
  order by p.last_active desc
  limit page_size;
$$;

revoke all on function discover_profiles(int) from public;
grant execute on function discover_profiles(int) to authenticated;
