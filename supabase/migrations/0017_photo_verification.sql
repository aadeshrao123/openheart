-- OpenHeart :: photo verification
--
-- The anti-bot gate. CLAUDE.md calls it the one rule that kills most bot and
-- spam traffic, and it is the reason photo_verified exists and has never been
-- client-writable.
--
-- Two checks, and neither is worth anything alone. A pose challenge says a live
-- person took this photo just now; a face comparison says that person is the
-- one in the profile photos. Pose without comparison lets anyone verify with
-- any face. Comparison without pose lets someone hold up a stolen photo.
--
-- A pass is automatic. A failure is not: it goes to a human. Face comparison is
-- measurably less accurate on darker skin, so an automatic reject would lock
-- real people out of a dating app unevenly, and AWS's own documentation says to
-- put a human in front of any decision that affects access to services.
--
-- No biometric data is stored here. Rekognition's CompareFaces and DetectFaces
-- are documented as stateless, the selfie is destroyed once a verdict is
-- final, and this table keeps a status and a reason code rather than a
-- similarity score.

create type verification_status as enum ('pending', 'passed', 'review', 'rejected');

-- The four poses the server can ask for. Named rather than stored as angles so
-- the tolerance can be retuned in one place once the sign convention is
-- confirmed against a real capture: AWS documents the range of Pose.Yaw as
-- -180 to 180 and does not document which direction is positive.
create type verification_challenge as enum ('turn_left', 'turn_right', 'look_up', 'look_down');

create table verification_attempts (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid not null references profiles(id) on delete cascade,

  -- Chosen by the server, never sent by the client. A client that picks its own
  -- challenge picks the one it has already prepared a photo for, which is the
  -- whole attack this is meant to stop.
  challenge      verification_challenge not null,

  status         verification_status not null default 'pending',
  selfie_r2_key  text not null unique,

  -- A code, never a similarity score. The score is a biometric measurement and
  -- a moderator does not need one to look at a photo and a pose.
  failure_reason text,

  created_at     timestamptz not null default now(),
  resolved_at    timestamptz,
  reviewed_by    uuid references profiles(id) on delete set null
);

alter table verification_attempts enable row level security;

create index verification_attempts_profile_idx
  on verification_attempts (profile_id, created_at desc);

-- The moderator queue reads exactly this.
create index verification_attempts_review_idx
  on verification_attempts (created_at)
  where status = 'review';

-- ------------------------------------------------------------------ policies
--
-- Read only, both ways. Every write goes through the Edge Function as the
-- service role or through the moderator function below, because a client that
-- can write its own attempt row can write itself a passed one.

create policy verification_attempts_select_own on verification_attempts
  for select to authenticated
  using ((select auth.uid()) = profile_id);

create policy verification_attempts_select_moderator on verification_attempts
  for select to authenticated
  using ((select public.is_moderator()));

grant select on verification_attempts to authenticated;

-- ---------------------------------------------------------------- rate limit
--
-- Bounds the AWS bill as much as the abuse. Each attempt is one DetectFaces
-- plus up to three CompareFaces, so an unbounded retry loop is somebody else
-- spending your money. Triggers still fire for the service role, which is what
-- makes this reachable at all given every insert comes from the Edge Function.
--
-- Five a day is generous for a real person failing on bad lighting twice.

create or replace function public.enforce_verification_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_attempts int;
  daily_limit constant int := 5;
begin
  select count(*) into recent_attempts
    from verification_attempts
   where profile_id = new.profile_id
     and created_at > now() - interval '24 hours';

  if recent_attempts >= daily_limit then
    raise exception 'verification rate limit exceeded'
      using errcode = '53400',
            hint = 'Try again tomorrow.';
  end if;

  return new;
end;
$$;

create trigger verification_attempts_rate_limit
  before insert on verification_attempts
  for each row execute function public.enforce_verification_rate_limit();

-- ------------------------------------------------------------ recording it
--
-- The only path that sets photo_verified. It stays out of every client grant,
-- so this function and the seed are the only things in the system that can
-- write it, and a user who could set it has defeated the entire anti-bot model.

create or replace function record_verification_result(
  attempt uuid,
  verdict verification_status,
  reason  text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile uuid;
begin
  if verdict = 'pending' then
    raise exception 'a result cannot leave the attempt pending'
      using errcode = '22023';
  end if;

  update verification_attempts
     set status         = verdict,
         failure_reason = reason,
         resolved_at    = case when verdict = 'review' then null else now() end
   where id = attempt
  returning profile_id into target_profile;

  if target_profile is null then
    raise exception 'attempt not found' using errcode = '42704';
  end if;

  if verdict = 'passed' then
    update profiles set photo_verified = true where id = target_profile;
  end if;
end;
$$;

-- service_role only. This is not something a signed-in user may call, and
-- `authenticated` is deliberately absent rather than gated inside the body.
revoke all on function record_verification_result(uuid, verification_status, text) from public;
grant execute on function record_verification_result(uuid, verification_status, text)
  to service_role;

-- --------------------------------------------------------- the review queue
--
-- security definer, like list_reports, because a suspended or unverified
-- profile is not readable through the ordinary policies and a moderator still
-- has to be able to see the person they are judging.

create or replace function list_verification_reviews()
returns table (
  id             uuid,
  profile_id     uuid,
  display_name   text,
  challenge      verification_challenge,
  failure_reason text,
  selfie_r2_key  text,
  created_at     timestamptz,
  attempt_count  int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.profile_id,
    p.display_name,
    a.challenge,
    a.failure_reason,
    a.selfie_r2_key,
    a.created_at,
    (
      select count(*)
        from verification_attempts other
       where other.profile_id = a.profile_id
    )::int
  from verification_attempts a
  join profiles p on p.id = a.profile_id
  where public.is_moderator()
    and a.status = 'review'
  order by a.created_at;
$$;

create or replace function review_verification(
  attempt  uuid,
  approved boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile uuid;
begin
  if not public.is_moderator() then
    raise exception 'not a moderator' using errcode = '42501';
  end if;

  -- Cast, because a case expression over string literals is text and the
  -- column is an enum. Postgres refuses the assignment rather than coercing.
  update verification_attempts
     set status      = (case when approved then 'passed' else 'rejected' end)
                         ::verification_status,
         reviewed_by = (select auth.uid()),
         resolved_at = now()
   where id = attempt
     and status = 'review'
  returning profile_id into target_profile;

  -- Absent or already resolved. Both are the same answer to a moderator acting
  -- on a queue somebody else has already worked through.
  if target_profile is null then
    raise exception 'attempt not found or already resolved' using errcode = '42704';
  end if;

  if approved then
    update profiles set photo_verified = true where id = target_profile;
  end if;

  -- The selfie has done its job either way. Queueing it here rather than in the
  -- client means it is destroyed whichever way the moderator decided and
  -- whether or not they closed the tab afterwards.
  insert into deleted_media (r2_key)
  select selfie_r2_key from verification_attempts where id = attempt
  on conflict (r2_key) do nothing;
end;
$$;

revoke all on function list_verification_reviews() from public;
revoke all on function review_verification(uuid, boolean) from public;

grant execute on function list_verification_reviews() to authenticated;
grant execute on function review_verification(uuid, boolean) to authenticated;
