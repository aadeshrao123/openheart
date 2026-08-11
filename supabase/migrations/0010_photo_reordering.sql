-- OpenHeart :: make photo reordering actually possible
--
-- 0006 granted `update (position) on photos to authenticated` and its comment
-- says "Reordering is the only mutation a client is allowed". 0002 never wrote
-- the policy to allow it, so with RLS enabled and no permissive UPDATE policy
-- every client update was denied. Measured as the authenticated role:
--
--   update photos set position = 3 where id = ...;  -->  UPDATE 0
--
-- Same class of bug as the missing service_role grants in 0009, in the opposite
-- direction: there, a policy with no grant; here, a grant with no policy. Both
-- are silent, and the only reason either surfaced is that something finally ran.

create policy photos_update_own on photos
  for update to authenticated
  using ((select auth.uid()) = profile_id)
  with check ((select auth.uid()) = profile_id);

-- ------------------------------------------------- reordering needs one statement
--
-- position carries `check (position between 0 and 5)` and `unique (profile_id,
-- position)`, so with a full grid there is no free slot to park a photo in while
-- two are exchanged, and a non-deferrable unique constraint is checked per row,
-- which makes even a single-statement swap fail. Measured:
--
--   update photos set position = case id when a then 1 when b then 0 end ...
--     --> duplicate key value violates unique constraint
--
-- DEFERRABLE INITIALLY IMMEDIATE moves the check from per row to per statement,
-- which is all this needs. Verified afterwards that a genuine duplicate insert
-- is still rejected, so request-photo-upload keeps getting 23505 and keeps
-- answering position_taken.

alter table photos
  drop constraint photos_profile_id_position_key;

alter table photos
  add constraint photos_profile_position_key
  unique (profile_id, position) deferrable initially immediate;

-- PostgREST gives each request its own transaction, so a client cannot hold two
-- updates inside one. The reorder therefore has to be a single statement the
-- server owns.
--
-- security invoker, so RLS still applies and the policy above is what stops a
-- caller reordering someone else's photos. Ids that are not theirs simply match
-- no row.
create or replace function public.set_photo_order(photo_ids uuid[])
returns void
language sql
security invoker
set search_path = public
as $$
  update photos p
     set position = ordered.new_position
    from (
      select id, (ordinality - 1)::int as new_position
        from unnest(photo_ids) with ordinality as u(id, ordinality)
    ) as ordered
   where p.id = ordered.id;
$$;

revoke all on function public.set_photo_order(uuid[]) from public;
grant execute on function public.set_photo_order(uuid[]) to authenticated;
