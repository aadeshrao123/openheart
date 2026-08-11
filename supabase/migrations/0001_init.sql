-- OpenHeart :: schema
-- Everything user-facing lives here. RLS is applied in 0002; this file only
-- defines shape. Never edit the schema through the Supabase dashboard.

create extension if not exists postgis;

create type swipe_direction as enum ('like', 'pass');
create type report_status   as enum ('pending', 'reviewed', 'actioned', 'dismissed');

-- ---------------------------------------------------------------- profiles

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  display_name    text        not null check (char_length(display_name) between 1 and 40),
  birthdate       date        not null,
  bio             text        check (char_length(bio) <= 500),
  gender          text,
  seeking         text[]      not null default '{}',

  -- rounded to ~1km before write (see round_location trigger). never precise.
  location        geography(point, 4326),

  max_distance_km int         not null default 50 check (max_distance_km between 1 and 500),
  age_min         int         not null default 18 check (age_min >= 18),
  age_max         int         not null default 99 check (age_max <= 120),

  is_active       boolean     not null default true,
  photo_verified  boolean     not null default false,

  last_active     timestamptz not null default now(),
  created_at      timestamptz not null default now(),

  constraint age_range_valid check (age_min <= age_max)
);

-- 18+ is enforced by trigger, not CHECK: CHECK constraints may not call
-- non-immutable functions like current_date.
create or replace function enforce_adult()
returns trigger language plpgsql as $$
begin
  if new.birthdate > (current_date - interval '18 years') then
    raise exception 'users must be 18 or older';
  end if;
  return new;
end;
$$;

create trigger profiles_enforce_adult
  before insert or update of birthdate on profiles
  for each row execute function enforce_adult();

-- Coarsen location to ~1km on every write. Precise coordinates never land in
-- the table, so they can never leak out of it.
create or replace function round_location()
returns trigger language plpgsql as $$
begin
  if new.location is not null then
    new.location := ST_SetSRID(
      ST_MakePoint(
        round(ST_X(new.location::geometry)::numeric, 2)::float8,
        round(ST_Y(new.location::geometry)::numeric, 2)::float8
      ), 4326)::geography;
  end if;
  return new;
end;
$$;

create trigger profiles_round_location
  before insert or update of location on profiles
  for each row execute function round_location();

create index profiles_location_idx    on profiles using gist (location);
create index profiles_discovery_idx   on profiles (is_active, photo_verified, last_active desc);

-- ------------------------------------------------------------------ photos

create table photos (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid not null references profiles(id) on delete cascade,
  r2_key           text not null unique,
  position         int  not null check (position between 0 and 5),
  moderation_state text not null default 'pending'
                     check (moderation_state in ('pending', 'approved', 'rejected')),
  created_at       timestamptz not null default now(),
  unique (profile_id, position)
);

create index photos_profile_idx on photos (profile_id);

-- ------------------------------------------------------------------ swipes

create table swipes (
  swiper_id  uuid not null references profiles(id) on delete cascade,
  target_id  uuid not null references profiles(id) on delete cascade,
  direction  swipe_direction not null,
  created_at timestamptz not null default now(),
  primary key (swiper_id, target_id),
  constraint no_self_swipe check (swiper_id <> target_id)
);

-- reciprocal lookup for the match trigger
create index swipes_reciprocal_idx on swipes (target_id, swiper_id) where direction = 'like';

-- ----------------------------------------------------------------- matches

create table matches (
  id           uuid primary key default gen_random_uuid(),
  user_a       uuid not null references profiles(id) on delete cascade,
  user_b       uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unmatched_by uuid references profiles(id) on delete set null,
  -- canonical ordering makes the unique constraint do the deduplication
  constraint match_ordered check (user_a < user_b),
  unique (user_a, user_b)
);

create index matches_user_a_idx on matches (user_a);
create index matches_user_b_idx on matches (user_b);

-- ---------------------------------------------------------------- messages

create table messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

create index messages_match_idx on messages (match_id, created_at desc);

-- ----------------------------------------------------------- reports/blocks

create table reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_id   uuid not null references profiles(id) on delete cascade,
  reason      text not null,
  detail      text,
  status      report_status not null default 'pending',
  created_at  timestamptz not null default now(),
  constraint no_self_report check (reporter_id <> target_id)
);

create index reports_triage_idx on reports (status, created_at);

create table blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on blocks (blocked_id);
