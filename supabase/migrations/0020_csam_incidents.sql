-- OpenHeart :: recording a known-material match
--
-- The scan went live and immediately exposed a gap. A Shield match and a photo
-- of a beer produced the same outcome: moderation_state 'rejected', the object
-- queued for purge, and nothing anywhere recording which it had been. Nobody
-- was told, the account was untouched, and the object was deleted.
--
-- You cannot report or preserve what you never wrote down, so this writes it
-- down. It records metadata and escalates to a person. It deliberately does not
-- decide whether to keep the object, which is a legal question: the Edge
-- Function reads PRESERVE_CSAM_MATCHES for that, and it defaults to off.

-- What the scanner said, alongside what was decided. Nullable, because every
-- row that predates this migration has no answer and inventing one would be
-- worse than an honest null.
alter table photos
  add column moderation_detail text;

-- 0009 grants service_role `update (moderation_state)`, a column list, so the
-- new column was not covered by it and the scanner could not write what it had
-- just decided. Caught by running the function, not by reading the migration.
-- Any column added to a table with a column-level grant needs this line.
grant update (moderation_detail) on photos to service_role;

-- ---------------------------------------------------------------- incidents
--
-- Separate from `reports` on purpose. A report is one user accusing another and
-- carries the reporter's own evidence snapshot. This is the system saying a
-- known image was uploaded, it has no reporter, and it may carry a legal duty
-- that an ordinary report does not.

create table csam_incidents (
  id             uuid primary key default gen_random_uuid(),

  -- No cascade. The evidence trail has to outlive the profile, and deletion is
  -- anonymization here so the row survives anyway.
  profile_id     uuid not null references profiles(id),

  -- Deliberately not a foreign key. The photos row can be deleted by its owner
  -- and the incident must not go with it.
  photo_id       uuid,

  -- Kept even after the object is purged, so a later report can name exactly
  -- what was matched.
  r2_key         text not null,

  -- Verbatim from the provider: csam, harmful-abusive-material, or whatever
  -- they add next. Not narrowed to an enum, because a value this table has
  -- never heard of is exactly the case that must not be silently dropped.
  classification text not null,

  detected_at    timestamptz not null default now(),

  -- Whether the object was held rather than purged. Set by the Edge Function
  -- from the policy switch, so the row records what actually happened rather
  -- than what the policy said at some later date.
  object_preserved boolean not null default false,

  -- Filled in once a report is made. Nothing in this codebase reports yet:
  -- that needs NCMEC registration, which is a maintainer task.
  reported_at      timestamptz,
  report_reference text,

  reviewed_at    timestamptz,
  reviewed_by    uuid references profiles(id) on delete set null,
  moderator_note text
);

alter table csam_incidents enable row level security;

create index csam_incidents_open_idx
  on csam_incidents (detected_at)
  where reviewed_at is null;

create index csam_incidents_profile_idx on csam_incidents (profile_id);

-- Moderators only, and read only. Every write goes through the service role or
-- the function below. There is deliberately no policy for the person the
-- incident is about: telling them what matched tells them what to avoid.
create policy csam_incidents_select_moderator on csam_incidents
  for select to authenticated
  using ((select public.is_moderator()));

grant select on csam_incidents to authenticated;
grant select, insert, update on csam_incidents to service_role;

-- ---------------------------------------------------------------- suspension
--
-- A function rather than a grant, following 0017: service_role holds no
-- privilege on profiles at all and this keeps it that way. A key that can write
-- one column of that table is a key that can be talked into writing others.
--
-- Only ever sets, never clears. Lifting is lift_suspension(), which is a
-- moderator action and stays one.

create or replace function suspend_for_known_material(
  target uuid,
  reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles
     set suspended_at     = now(),
         suspended_reason = reason
   where id = target
     and suspended_at is null;
end;
$$;

revoke all on function suspend_for_known_material(uuid, text) from public;
grant execute on function suspend_for_known_material(uuid, text) to service_role;

-- ------------------------------------------------------------------- queue

create or replace function list_csam_incidents(include_reviewed boolean default false)
returns table (
  id               uuid,
  profile_id       uuid,
  display_name     text,
  classification   text,
  detected_at      timestamptz,
  object_preserved boolean,
  reported_at      timestamptz,
  reviewed_at      timestamptz,
  moderator_note   text,
  profile_suspended boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.profile_id,
    p.display_name,
    i.classification,
    i.detected_at,
    i.object_preserved,
    i.reported_at,
    i.reviewed_at,
    i.moderator_note,
    p.suspended_at is not null
  from csam_incidents i
  join profiles p on p.id = i.profile_id
  where public.is_moderator()
    and (include_reviewed or i.reviewed_at is null)
  order by i.reviewed_at is null desc, i.detected_at;
$$;

create or replace function review_csam_incident(
  incident  uuid,
  note      text default null,
  reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'not a moderator' using errcode = '42501';
  end if;

  update csam_incidents
     set reviewed_at    = now(),
         reviewed_by    = (select auth.uid()),
         moderator_note = note,
         -- Only ever set, never cleared. A reference recorded once is a fact
         -- about a report that was made.
         report_reference = coalesce(reference, report_reference),
         reported_at      = case
                              when reference is not null then coalesce(reported_at, now())
                              else reported_at
                            end
   where id = incident;

  if not found then
    raise exception 'incident not found' using errcode = '42704';
  end if;
end;
$$;

revoke all on function list_csam_incidents(boolean) from public;
revoke all on function review_csam_incident(uuid, text, text) from public;

grant execute on function list_csam_incidents(boolean) to authenticated;
grant execute on function review_csam_incident(uuid, text, text) to authenticated;
