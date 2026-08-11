-- OpenHeart :: safety and moderation
--
-- Verified against this database before the migration was written: a user who
-- blocked someone they were already matched with could still be messaged by
-- them. Nothing on messages or matches consulted blocks, so blocking only
-- affected discovery. That is worse than having no block at all, because the
-- person believes they are protected and stops taking other precautions.

-- ------------------------------------------------------- blocking ends it

create or replace function public.is_match_blocked(m uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from matches mt
      join blocks b
        on (b.blocker_id = mt.user_a and b.blocked_id = mt.user_b)
        or (b.blocker_id = mt.user_b and b.blocked_id = mt.user_a)
     where mt.id = m
  );
$$;

-- unmatched_by is set to the blocker rather than a flag of its own, because
-- the blocked party must not be able to tell a block from an unmatch. Both
-- render identically, and the conversation history survives for both: those
-- messages are the blocked user's data too, and taking them away would itself
-- be the tell.
create or replace function public.close_match_on_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update matches
     set unmatched_by = new.blocker_id
   where unmatched_by is null
     and user_a = least(new.blocker_id, new.blocked_id)
     and user_b = greatest(new.blocker_id, new.blocked_id);

  return new;
end;
$$;

create trigger blocks_close_match
  after insert on blocks
  for each row execute function public.close_match_on_block();

-- ---------------------------------------------------------------- suspension
--
-- Neither column is in any grant, so a client cannot write them. is_active is
-- client-writable and stays that way, which is why the trigger below exists:
-- without it a suspended user reactivates themselves and reappears everywhere
-- that only checks is_active.

alter table profiles
  add column suspended_at     timestamptz,
  add column suspended_reason text;

create or replace function public.is_suspended(who uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = who and suspended_at is not null
  );
$$;

create or replace function public.enforce_suspension()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.suspended_at is not null and new.is_active and not old.is_active then
    raise exception 'a suspended profile cannot be reactivated'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_suspension
  before update on profiles
  for each row execute function public.enforce_suspension();

-- ------------------------------------------------------- message tightening

drop policy messages_insert_member on messages;

create policy messages_insert_member on messages
  for insert to authenticated
  with check (
    (select auth.uid()) = sender_id
    and public.is_match_member(match_id)
    and not public.is_match_blocked(match_id)
    and not public.is_suspended((select auth.uid()))
    and exists (
      select 1
        from matches
       where id = match_id
         and unmatched_by is null
    )
  );

-- Reading is deliberately untouched. Losing the history would tell the blocked
-- user exactly what happened, and it is their conversation as well.

-- ------------------------------------------------------------------ reports
--
-- match_id and evidence are what make the queue usable by a human. Moderators
-- deliberately get no blanket read access to messages: the reporter submits a
-- snapshot of what they are reporting, so the only conversation content a
-- moderator ever sees is the part someone chose to hand over.

alter table reports
  add column match_id       uuid references matches(id) on delete set null,
  add column evidence       jsonb,
  add column moderator_note text,
  add column resolved_by    uuid references profiles(id) on delete set null,
  add column resolved_at    timestamptz;

grant insert (reporter_id, target_id, reason, detail, match_id, evidence)
  on reports to authenticated;

-- Resolution goes through resolve_report so the verdict, the note and who
-- recorded it are written together and cannot be set independently.
revoke update on reports from authenticated;

drop policy reports_update_moderator on reports;

create or replace function public.enforce_report_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_reports int;
  hourly_limit constant int := 20;
begin
  select count(*) into recent_reports
    from reports
   where reporter_id = new.reporter_id
     and created_at > now() - interval '1 hour';

  if recent_reports >= hourly_limit then
    raise exception 'report rate limit exceeded'
      using errcode = '53400',
            hint = 'Reporting many people at once is itself a harassment tool.';
  end if;

  return new;
end;
$$;

create trigger reports_rate_limit
  before insert on reports
  for each row execute function public.enforce_report_rate_limit();

create index reports_reporter_recent_idx on reports (reporter_id, created_at desc);
create index reports_target_idx on reports (target_id);

-- --------------------------------------------------------------- the queue
--
-- The reporter's name is deliberately absent. A moderator does not need it to
-- judge a report, and reporter_id alone is enough to notice someone filing
-- twenty of them.

create or replace function list_reports(include_resolved boolean default false)
returns table (
  id               uuid,
  reason           text,
  detail           text,
  status           report_status,
  created_at       timestamptz,
  evidence         jsonb,
  reporter_id      uuid,
  target_id        uuid,
  target_name      text,
  target_suspended boolean,
  target_reports   int,
  moderator_note   text,
  resolved_at      timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.reason,
    r.detail,
    r.status,
    r.created_at,
    r.evidence,
    r.reporter_id,
    r.target_id,
    target.display_name,
    target.suspended_at is not null,
    (select count(*) from reports other where other.target_id = r.target_id)::int,
    r.moderator_note,
    r.resolved_at
  from reports r
  join profiles target on target.id = r.target_id
  where public.is_moderator()
    and (include_resolved or r.status = 'pending')
  order by r.status = 'pending' desc, r.created_at;
$$;

create or replace function resolve_report(
  report  uuid,
  verdict report_status,
  note    text default null,
  suspend boolean default false
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

  if verdict = 'pending' then
    raise exception 'a resolution cannot leave the report pending'
      using errcode = '22023';
  end if;

  update reports
     set status         = verdict,
         moderator_note = note,
         resolved_by    = (select auth.uid()),
         resolved_at    = now()
   where id = report
  returning target_id into target_profile;

  if target_profile is null then
    raise exception 'report not found' using errcode = '42704';
  end if;

  if suspend then
    update profiles
       set suspended_at     = now(),
           suspended_reason = note,
           is_active        = false
     where id = target_profile;
  end if;
end;
$$;

-- Lifting a suspension is a separate call on purpose: it is not the resolution
-- of a report and should not be reachable by passing a flag to one.
create or replace function lift_suspension(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not a moderator' using errcode = '42501';
  end if;

  -- is_active stays false. The account is theirs to bring back, and flipping
  -- it here would put a profile in front of strangers without its owner
  -- knowing the suspension had ended.
  update profiles
     set suspended_at     = null,
         suspended_reason = null
   where id = target;
end;
$$;

revoke all on function list_reports(boolean) from public;
revoke all on function resolve_report(uuid, report_status, text, boolean) from public;
revoke all on function lift_suspension(uuid) from public;

grant execute on function list_reports(boolean) to authenticated;
grant execute on function resolve_report(uuid, report_status, text, boolean) to authenticated;
grant execute on function lift_suspension(uuid) to authenticated;
