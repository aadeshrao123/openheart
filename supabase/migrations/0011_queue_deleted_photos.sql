-- OpenHeart :: queue every deleted photo object for purge
--
-- delete_my_account() queues a leaver's photos before dropping the rows, but an
-- ordinary "remove this photo" from the grid did not. Measured: deleting one
-- photo row left deleted_media empty, so the object stayed in R2 with nothing
-- left in the database naming it. Unreachable by the app and still fetchable by
-- anyone holding the URL, which is the situation deleted_media exists to avoid.
--
-- A trigger rather than another call site. The client deletes rows directly, the
-- account deletion function deletes rows, and a profile delete cascades into
-- them, so putting this anywhere but the table means the next path that removes
-- a photo forgets again.

create or replace function public.queue_deleted_photo()
returns trigger
language plpgsql
-- security definer because deleted_media is deny-all: authenticated has neither
-- a grant nor a policy on it, and must not, or a client could read the purge
-- queue and learn other people's keys.
security definer
set search_path = public
as $$
begin
  insert into deleted_media (r2_key)
  values (old.r2_key)
  on conflict (r2_key) do nothing;

  return old;
end;
$$;

create trigger photos_queue_purge
  after delete on photos
  for each row execute function public.queue_deleted_photo();

-- delete_my_account() still queues explicitly. That is now redundant rather than
-- wrong: the insert is on conflict do nothing, and leaving it means the function
-- does not silently depend on a trigger for a guarantee it documents itself.
