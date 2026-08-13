-- OpenHeart :: undo the last swipe
--
-- Rewind is a paid feature on every mainstream app. It is free here, and it is
-- an RPC rather than a delete grant because three rules have to hold together
-- and a grant can express none of them.
--
--   1. Only the most recent swipe. Not an arbitrary one, or this is a way to
--      quietly rewrite months of history.
--   2. Only within a short window. Undo is for the thumb that slipped.
--   3. Never one that created a match. The other person has already been told
--      they matched, and may already be in the conversation. Taking that back
--      is not an undo, it is deleting somebody else's match.
--
-- Rule 3 is the reason this is not simply `grant delete on swipes`.

create or replace function undo_last_swipe()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me      uuid := (select auth.uid());
  last_id uuid;
  swiped  timestamptz;
  matched boolean;
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select target_id, created_at
    into last_id, swiped
    from swipes
   where swiper_id = me
   order by created_at desc
   limit 1;

  if last_id is null then
    return null;
  end if;

  if swiped < now() - interval '3 minutes' then
    raise exception 'too late to undo' using errcode = 'P0001';
  end if;

  select exists (
    select 1
      from matches
     where unmatched_by is null
       and least(me, last_id) = user_a
       and greatest(me, last_id) = user_b
  ) into matched;

  if matched then
    raise exception 'that one matched' using errcode = 'P0002';
  end if;

  delete from swipes where swiper_id = me and target_id = last_id;

  return last_id;
end;
$$;

revoke all on function undo_last_swipe() from public;
grant execute on function undo_last_swipe() to authenticated;
