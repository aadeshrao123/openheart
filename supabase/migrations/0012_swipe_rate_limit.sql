-- OpenHeart :: rate limit swipes
--
-- One of the v1 non-negotiables in CLAUDE.md, and the cheapest defence against
-- the failure mode that kills free dating apps: a script with the anon key and
-- a terminal enumerating every profile in a city, right-swiping all of them to
-- farm matches, and messaging the results.
--
-- In the database rather than the client, for the same reason the age gate is:
-- client-side enforcement is a suggestion to anyone holding the anon key.
--
-- A trigger rather than a policy. An RLS predicate cannot say "and no more than
-- N of these in the last hour" without counting the table it is guarding on
-- every insert, and a policy that fails is indistinguishable from a policy that
-- denies, so the caller would get a generic permission error instead of
-- something the app can explain.

-- Generous on purpose. A real person swiping steadily manages perhaps 300 in an
-- hour; a script does that in seconds. This is meant to stop enumeration, not
-- to ration a normal evening, and a limit low enough to annoy real users is a
-- limit that gets raised until it does nothing.
create or replace function public.enforce_swipe_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_swipes int;
  hourly_limit constant int := 500;
begin
  select count(*) into recent_swipes
    from swipes
   where swiper_id = new.swiper_id
     and created_at > now() - interval '1 hour';

  if recent_swipes >= hourly_limit then
    -- A distinct SQLSTATE so the client can tell this apart from a genuine
    -- permission failure and say something true about it. 53400 is
    -- configuration_limit_exceeded.
    raise exception 'swipe rate limit exceeded'
      using errcode = '53400',
            hint = 'Wait a while before swiping again.';
  end if;

  return new;
end;
$$;

-- Before the match trigger, which is AFTER INSERT: a swipe that is refused here
-- must never create a match.
create trigger swipes_rate_limit
  before insert on swipes
  for each row execute function public.enforce_swipe_rate_limit();

-- The count above filters on swiper_id and created_at. swipes_pkey leads with
-- swiper_id but carries no timestamp, so without this every check scans every
-- swipe the user has ever made, and the cost grows with account age.
create index if not exists swipes_recent_idx on swipes (swiper_id, created_at desc);
