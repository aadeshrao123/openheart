-- OpenHeart :: like a particular photo or answer, and say why
--
-- A swipe was a direction. Hinge's actual loop is that you like one specific
-- thing on a profile and can attach a sentence to it, the other person sees
-- what you picked and what you said, and a like back opens the conversation
-- with that sentence already in it. That is a better first message than "hey"
-- and it is the reason their profiles are read rather than flicked past.
--
-- This changes one of the invariants in CLAUDE.md, deliberately and narrowly.
-- "swipes are readable only by their author" becomes "a pass is readable only
-- by its author; a like is also readable by the person it is aimed at". The
-- half that matters is untouched: nobody ever learns that somebody passed on
-- them, and nobody can enumerate. Without the change there is no way to show
-- an incoming like at all, and putting that behind a payment is what every
-- other app does and what this one refuses.

alter table swipes
  add column if not exists comment text
    check (comment is null or length(trim(comment)) between 1 and 240),

  add column if not exists liked_photo_id uuid references photos (id) on delete set null,

  add column if not exists liked_prompt text
    check (liked_prompt is null or length(liked_prompt) between 1 and 40);

-- One thing, not both. A like points at a photo or an answer or nothing.
alter table swipes drop constraint if exists swipes_one_liked_thing;
alter table swipes add constraint swipes_one_liked_thing
  check (liked_photo_id is null or liked_prompt is null);

-- Nothing is attached to a pass. There is no screen that would show it and no
-- reason to keep the text of one.
alter table swipes drop constraint if exists swipes_extras_are_likes;
alter table swipes add constraint swipes_extras_are_likes
  check (
    direction = 'like'
    or (comment is null and liked_photo_id is null and liked_prompt is null)
  );

create index if not exists swipes_incoming_likes_idx
  on swipes (target_id, created_at desc)
  where direction = 'like';

-- ------------------------------------------------------------------ policy
--
-- Likes only, aimed at the caller only, and not across a block. 0006 granted
-- select on the whole table, so the new columns need no grant of their own.

create policy swipes_select_incoming_likes on swipes
  for select to authenticated
  using (
    direction = 'like'
    and target_id = (select auth.uid())
    and not public.is_blocked((select auth.uid()), swiper_id)
  );

-- ----------------------------------------------------------------- trigger
--
-- The comment becomes the opening message. Hinge shows it as the thing that
-- started the conversation, which is exactly what it is, and a match that
-- opens on an empty thread wastes the one sentence somebody already wrote.
--
-- Both sides may have commented, so both are inserted, oldest first.

create or replace function create_match_on_mutual_like()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  reciprocal swipes%rowtype;
  match_row  matches%rowtype;
begin
  if new.direction <> 'like' then
    return new;
  end if;

  select * into reciprocal
    from swipes
   where swiper_id = new.target_id
     and target_id = new.swiper_id
     and direction = 'like';

  if not found then
    return new;
  end if;

  insert into matches (user_a, user_b)
  values (least(new.swiper_id, new.target_id), greatest(new.swiper_id, new.target_id))
  on conflict (user_a, user_b) do nothing
  returning * into match_row;

  -- Nothing returned means the match already existed, so its opening messages
  -- were written when it was created and must not be written twice.
  if match_row.id is null then
    return new;
  end if;

  if reciprocal.comment is not null then
    insert into messages (match_id, sender_id, body, created_at)
    values (match_row.id, reciprocal.swiper_id, reciprocal.comment, reciprocal.created_at);
  end if;

  if new.comment is not null then
    insert into messages (match_id, sender_id, body, created_at)
    values (match_row.id, new.swiper_id, new.comment, new.created_at);
  end if;

  return new;
end;
$$;

-- -------------------------------------------------------------- likes you
--
-- security definer for the same reason discover_profiles is: 0016 narrowed the
-- profiles select grant to a column list, so a join from the client cannot read
-- an age. The block check and the like check are ordinary predicates here and
-- are the only thing enforcing them.

create or replace function likes_received()
returns table (
  swiper_id      uuid,
  display_name   text,
  age            int,
  photo_key      text,
  comment        text,
  liked_photo_id uuid,
  liked_prompt   text,
  created_at     timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.swiper_id,
    p.display_name,
    extract(year from age(p.birthdate))::int,
    (
      select ph.r2_key
        from photos ph
       where ph.profile_id = p.id
         and ph.moderation_state = 'approved'
       order by ph.position
       limit 1
    ),
    s.comment,
    s.liked_photo_id,
    s.liked_prompt,
    s.created_at
  from swipes s
  join profiles p on p.id = s.swiper_id
  where s.target_id = (select auth.uid())
    and s.direction = 'like'
    and p.is_active
    and p.deleted_at is null
    and p.photo_verified
    and not exists (
      select 1
        from blocks b
       where (b.blocker_id = s.target_id and b.blocked_id = s.swiper_id)
          or (b.blocker_id = s.swiper_id and b.blocked_id = s.target_id)
    )

    -- Already answered, so it belongs in matches rather than here.
    and not exists (
      select 1
        from swipes mine
       where mine.swiper_id = s.target_id
         and mine.target_id = s.swiper_id
    )
  order by s.created_at desc;
$$;

revoke all on function likes_received() from public;
grant execute on function likes_received() to authenticated;
