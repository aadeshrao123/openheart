-- OpenHeart :: push notification tokens
--
-- Built before the developer accounts exist, because none of it needs them and
-- none of it can be added retroactively to a shipped client.
--
-- Nothing sends anything yet. Sending needs Expo's push service and belongs in
-- an Edge Function with the service role.

create table push_tokens (
  -- The primary key, because the same device reinstalled hands back the same
  -- token and must not accumulate rows.
  token       text primary key,

  profile_id  uuid not null references profiles(id) on delete cascade,

  -- Recorded rather than derived: a token string is opaque, and guessing from
  -- its shape is how a notification silently goes nowhere.
  platform    text not null check (platform in ('ios', 'android', 'web')),

  created_at  timestamptz not null default now(),

  -- Touched on every launch. A token unseen for months belongs to an app that
  -- was uninstalled.
  last_seen   timestamptz not null default now()
);

alter table push_tokens enable row level security;

create index push_tokens_profile_idx on push_tokens (profile_id);

-- ------------------------------------------------------------------ policies
--
-- No insert or update policy, and no insert or update grant. Both live in the
-- function below, for the reason given there.

create policy push_tokens_select_own on push_tokens
  for select to authenticated
  using ((select auth.uid()) = profile_id);

-- Signing out on a shared device has to remove the token, or the next person's
-- phone keeps receiving the previous person's matches.
create policy push_tokens_delete_own on push_tokens
  for delete to authenticated
  using ((select auth.uid()) = profile_id);

grant select on push_tokens to authenticated;
grant delete on push_tokens to authenticated;

-- The send path reads every token for a recipient, crossing the select policy
-- deliberately.
grant select, delete on push_tokens to service_role;

-- ------------------------------------------------------------- registration
--
-- The only write path, because a policy cannot express the rule this needs.
--
-- The same token has to be able to move between accounts: one phone lent to a
-- friend, or one person with two accounts. Under a plain update policy the new
-- signer-in does not own the existing row, so the handover is denied and the
-- phone is stuck on the previous account.
--
-- security definer makes the handover possible. What makes it safe is that the
-- token is the proof: it is issued to the device, readable by no other user
-- through any policy here, and present in no payload anyone else receives.
-- Presenting one means holding the phone.
--
-- If that is ever wrong the consequence is a rerouted notification, so push
-- payloads must never carry message text.

create or replace function register_push_token(
  push_token text,
  device     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into push_tokens (token, profile_id, platform)
  values (push_token, me, device)
  on conflict (token) do update
     set profile_id = me,
         platform   = excluded.platform,
         last_seen  = now();
end;
$$;

revoke all on function register_push_token(text, text) from public;
grant execute on function register_push_token(text, text) to authenticated;

-- ------------------------------------------------------------------ deletion
--
-- The cascade above never fires: deletion is anonymization and the profile row
-- survives. Cleared explicitly instead.

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  insert into deleted_media (r2_key)
  select r2_key
    from photos
   where profile_id = me
  on conflict (r2_key) do nothing;

  delete from photos where profile_id = me;

  -- A device still receiving notifications for a deleted account is the most
  -- visible possible failure of "deleted".
  delete from push_tokens where profile_id = me;

  update matches
     set unmatched_by = me
   where unmatched_by is null
     and me in (user_a, user_b);

  update profiles
     set display_name   = '',
         bio            = null,
         gender         = null,
         seeking        = '{}',
         location       = null,
         birthdate      = null,
         is_active      = false,
         photo_verified = false,
         deleted_at     = now()
   where id = me;

  -- suspended_at and suspended_reason stay, so leaving cannot clear a record.

  delete from auth.users where id = me;
end;
$$;

revoke all on function delete_my_account() from public;
grant execute on function delete_my_account() to authenticated;
