-- OpenHeart :: one notification per conversation, not one per message
--
-- 0029 notified on every insert. Ten messages in a row buzzed a phone ten
-- times, which is how an app teaches somebody to turn its notifications off,
-- and the ones it teaches them to turn off are the matches.
--
-- The rule: say nothing if they have not read the last thing yet. They have
-- already been told, and the notification they were told with is still sitting
-- on their lock screen saying the same thing this one would.
--
-- It is also most of the cost. Every notification is an Edge Function
-- invocation, and a conversation is bursty by nature, so the messages this
-- skips are the bulk of them.

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  select case when m.user_a = new.sender_id then m.user_b else m.user_a end
    into other
    from matches m
   where m.id = new.match_id
     and m.unmatched_by is null;

  if other is null then
    return new;
  end if;

  if exists (
    select 1 from blocks
     where (blocker_id, blocked_id) in ((other, new.sender_id), (new.sender_id, other))
  ) then
    return new;
  end if;

  if exists (
    select 1 from hidden_matches where match_id = new.match_id and user_id = other
  ) then
    return new;
  end if;

  -- Unread and recent, not merely unread.
  --
  -- Unread alone was wrong in a way worth writing down. A notification can fail
  -- to arrive: the token expired, the phone was off, push was misconfigured. On
  -- the unread-only rule that first failure silences the conversation for good,
  -- because every later message sees the unread one and assumes it did its job.
  -- The recency window bounds that to half an hour instead of forever.
  --
  -- So a burst is one notification, and somebody who has genuinely stopped
  -- looking is reminded occasionally rather than never or constantly.
  --
  -- id <> new.id because this is an after trigger and the row being inserted is
  -- already visible to this query.
  --
  -- deleted_at is null so an unsent message does not count as having told them
  -- anything: the notification it produced pointed at a message that is gone.
  if exists (
    select 1
      from messages
     where match_id   = new.match_id
       and sender_id  = new.sender_id
       and read_at    is null
       and deleted_at is null
       and created_at > now() - interval '30 minutes'
       and id <> new.id
  ) then
    return new;
  end if;

  perform public.queue_push(other, 'message', new.match_id);

  return new;
end;
$$;
