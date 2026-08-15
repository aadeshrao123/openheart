-- OpenHeart :: a second pose
--
-- 0017 asked for one pose. One pose is a one in four guess: somebody who has
-- four photos of a stolen face, one per challenge, passes on the first try
-- whichever challenge comes back. The pose stops being a liveness signal at
-- exactly the moment somebody bothers to prepare for it.
--
-- Two distinct poses in one attempt is one in twelve, and both upload URLs
-- expire together, so the pair has to be produced there and then. The second
-- selfie is also compared against the first, which is the half that matters:
-- without it an attacker holds one prepared photo of the victim for pose one
-- and their own live face for pose two, and two poses buy nothing at all.
--
-- Nullable, because a shipped client never dies and the schema is a public
-- API. Rows written before this migration keep one pose and stay readable.

alter table verification_attempts
  add column challenge_two     verification_challenge,
  add column selfie_two_r2_key text unique;

-- The same pose twice is one photo used twice, which is the one pair that
-- proves nothing.
alter table verification_attempts
  add constraint verification_attempts_poses_differ
  check (challenge_two is null or challenge_two <> challenge);

-- ---------------------------------------------------------- the review queue
--
-- A moderator judging a failure has to see both poses. Seeing one and being
-- told there was another is worse than useless: it invites approving on half
-- the evidence.
--
-- Dropped rather than replaced. Adding a column to a `returns table` changes
-- the return type, and create or replace refuses that outright.

drop function if exists list_verification_reviews();

create function list_verification_reviews()
returns table (
  id                uuid,
  profile_id        uuid,
  display_name      text,
  challenge         verification_challenge,
  challenge_two     verification_challenge,
  failure_reason    text,
  selfie_r2_key     text,
  selfie_two_r2_key text,
  created_at        timestamptz,
  attempt_count     int
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
    a.challenge_two,
    a.failure_reason,
    a.selfie_r2_key,
    a.selfie_two_r2_key,
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

revoke all on function list_verification_reviews() from public;
grant execute on function list_verification_reviews() to authenticated;

-- Both selfies, or the second one outlives the decision it was evidence for.
-- The Edge Function queues both on an automatic verdict; this is the path a
-- moderator takes, and it has to destroy exactly as much.
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

  update verification_attempts
     set status      = (case when approved then 'passed' else 'rejected' end)
                         ::verification_status,
         reviewed_by = (select auth.uid()),
         resolved_at = now()
   where id = attempt
     and status = 'review'
  returning profile_id into target_profile;

  if target_profile is null then
    raise exception 'attempt not found or already resolved' using errcode = '42704';
  end if;

  if approved then
    update profiles set photo_verified = true where id = target_profile;
  end if;

  insert into deleted_media (r2_key)
  select key
    from verification_attempts a
   cross join unnest(array[a.selfie_r2_key, a.selfie_two_r2_key]) as key
   where a.id = attempt
     and key is not null
  on conflict (r2_key) do nothing;
end;
$$;

revoke all on function review_verification(uuid, boolean) from public;
grant execute on function review_verification(uuid, boolean) to authenticated;
