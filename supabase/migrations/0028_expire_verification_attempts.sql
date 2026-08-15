-- OpenHeart :: abandoned verification attempts
--
-- A selfie reached storage before anything judged it. request-verification
-- signs the upload URL, the phone uploads, and only then does verify-selfie run
-- and queue the key for deletion. Close the app in between and the attempt sits
-- at pending forever, and nothing in the system has ever looked at those rows
-- again: deleted_media is the only path into the purge job, and a pending
-- attempt never enters it.
--
-- So the selfie stayed in R2 indefinitely. The privacy policy says it is
-- deleted as soon as the check finishes, which is not a promise you can keep
-- for a check that never finishes, and 0026 doubled the leak by uploading two.
--
-- Twenty four hours is far past any real attempt. The upload URLs expire after
-- ten minutes, so an attempt older than a day cannot be completed anyway and
-- the row is only holding the keys hostage.

create or replace function expire_stale_verification_attempts(
  older_than interval default '24 hours'
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  expired int;
begin
  -- One statement so the keys cannot be queued for an attempt that failed to
  -- expire, or an attempt expired whose keys were never queued. The
  -- data-modifying CTE runs whether or not the final select reads it.
  with stale as (
    update verification_attempts
       set status         = 'rejected',
           failure_reason = 'expired',
           resolved_at    = now()
     where status = 'pending'
       and created_at < now() - older_than
    returning selfie_r2_key, selfie_two_r2_key
  ),
  queued as (
    insert into deleted_media (r2_key)
    select key
      from stale
     cross join unnest(array[stale.selfie_r2_key, stale.selfie_two_r2_key]) as key
     where key is not null
    on conflict (r2_key) do nothing
    returning r2_key
  )
  select count(*) into expired from stale;

  return expired;
end;
$$;

-- The purge job calls this, and it runs as the service role. Nothing a signed
-- in user does should be able to resolve somebody else's attempt.
revoke all on function expire_stale_verification_attempts(interval) from public;
grant execute on function expire_stale_verification_attempts(interval) to service_role;
