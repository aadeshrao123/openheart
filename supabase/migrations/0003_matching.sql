-- OpenHeart :: match creation + discovery
--
-- Both live in the database on purpose. The match trigger must be atomic with
-- the swipe that causes it, and the discovery query needs the GiST index and
-- must not be able to return rows the caller isn't allowed to see.

-- ----------------------------------------------------- match on mutual like
-- Fires inside the same transaction as the swipe insert. `user_a < user_b`
-- plus the unique constraint means concurrent swipes deduplicate at the DB
-- level rather than racing in application code.

create or replace function create_match_on_mutual_like()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reciprocal boolean;
begin
  if new.direction <> 'like' then
    return new;
  end if;

  select exists (
    select 1 from swipes
     where swiper_id = new.target_id
       and target_id = new.swiper_id
       and direction = 'like'
  ) into reciprocal;

  if reciprocal then
    insert into matches (user_a, user_b)
    values (least(new.swiper_id, new.target_id), greatest(new.swiper_id, new.target_id))
    on conflict (user_a, user_b) do nothing;
  end if;

  return new;
end;
$$;

create trigger swipes_create_match
  after insert on swipes
  for each row execute function create_match_on_mutual_like();

-- --------------------------------------------------------------- discovery
-- security invoker: RLS on `profiles` still applies, so this cannot become a
-- way to read blocked or inactive profiles. Filters here are for relevance and
-- for using the indexes, not for authorization.

create or replace function discover_profiles(page_size int default 20)
returns table (
  id             uuid,
  display_name   text,
  bio            text,
  gender         text,
  age            int,
  distance_bucket_km int,
  last_active    timestamptz
)
language sql stable security invoker set search_path = public as $$
  with me as (
    select *
      from profiles
     where id = (select auth.uid())
  )
  select
    p.id,
    p.display_name,
    p.bio,
    p.gender,
    extract(year from age(p.birthdate))::int as age,
    -- rounded to 5km. never return a precise distance: precise distances from
    -- a few vantage points trilaterate to a home address.
    (round((ST_Distance(p.location, me.location) / 1000.0) / 5) * 5)::int as distance_bucket_km,
    p.last_active
  from profiles p, me
  where p.id <> me.id
    and p.is_active
    and p.photo_verified
    and ST_DWithin(p.location, me.location, me.max_distance_km * 1000)
    and extract(year from age(p.birthdate)) between me.age_min and me.age_max
    and not exists (
      select 1 from swipes s where s.swiper_id = me.id and s.target_id = p.id
    )
  order by p.last_active desc
  limit page_size;
$$;
