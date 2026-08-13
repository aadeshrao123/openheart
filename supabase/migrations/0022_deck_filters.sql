-- OpenHeart :: filters on the fields 0021 added
--
-- Every one of these is a paid tier somewhere else. They are free here for the
-- same reason everything else is.
--
-- No select grant, deliberately. These say what their owner wants to see, not
-- what they are, and 0016 established that the profiles select grant is an
-- explicit list of what one person may read off another. my_profile() is
-- security definer and returns the whole row, so the owner still reads them.

alter table profiles
  add column if not exists filter_intents text[]
    check (filter_intents is null or (
      array_length(filter_intents, 1) <= 6 and array_position(filter_intents, null) is null
    )),

  add column if not exists filter_interests text[]
    check (filter_interests is null or (
      array_length(filter_interests, 1) <= 8 and array_position(filter_interests, null) is null
    )),

  add column if not exists filter_height_min_cm smallint
    check (filter_height_min_cm is null or filter_height_min_cm between 120 and 250),

  add column if not exists filter_height_max_cm smallint
    check (filter_height_max_cm is null or filter_height_max_cm between 120 and 250),

  add column if not exists filter_has_bio boolean not null default false;

alter table profiles
  add constraint profiles_filter_height_order
  check (
    filter_height_min_cm is null
    or filter_height_max_cm is null
    or filter_height_min_cm <= filter_height_max_cm
  );

grant insert (
  filter_intents, filter_interests, filter_height_min_cm,
  filter_height_max_cm, filter_has_bio
) on public.profiles to authenticated;

grant update (
  filter_intents, filter_interests, filter_height_min_cm,
  filter_height_max_cm, filter_has_bio
) on public.profiles to authenticated;

-- ----------------------------------------------------------------- discovery
--
-- Each filter is skipped when unset, so a profile that has never opened the
-- screen sees everyone. A filter on a column the other person left null
-- excludes them, which is the honest reading: they did not say.
--
-- The four authorization predicates from 0008 are unchanged and are still the
-- only thing standing in for RLS inside a security definer function.

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

    and (me.filter_intents is null or p.relationship_intent = any (me.filter_intents))
    and (me.filter_interests is null or p.interests && me.filter_interests)
    and (me.filter_height_min_cm is null or p.height_cm >= me.filter_height_min_cm)
    and (me.filter_height_max_cm is null or p.height_cm <= me.filter_height_max_cm)
    and (not me.filter_has_bio or length(trim(coalesce(p.bio, ''))) > 0)

  order by p.last_active desc
  limit page_size;
$$;

revoke all on function discover_profiles(int) from public;
grant execute on function discover_profiles(int) to authenticated;
