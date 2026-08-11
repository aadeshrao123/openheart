-- OpenHeart :: minimum supported version and remote kill switches
--
-- A shipped mobile client never dies. Some users never update, and the App
-- Store rollback story is "submit a new build and wait for review". Two
-- capabilities have to exist in version 1.0 because they cannot be added
-- retroactively to clients already on people's phones:
--
--   1. the server can tell an old client to stop and update
--   2. the server can disable a single broken feature without a new build
--
-- Both are read on launch. Neither requires the client to know what the flags
-- will eventually mean, which is the whole point.

create table release_policy (
  platform                 text primary key
    check (platform in ('ios', 'android', 'web')),

  -- Semver. Clients below this refuse to run and show an update prompt.
  minimum_supported_version text not null,

  -- Below this, the client nags but still works.
  recommended_version       text not null,

  -- Feature name to enabled flag. Unknown keys are ignored by older clients,
  -- which is what makes this forward compatible.
  features                  jsonb not null default '{}'::jsonb,

  updated_at                timestamptz not null default now()
);

alter table release_policy enable row level security;

-- Readable before sign-in: the version gate has to work on the launch screen,
-- which is reached before any session exists.
create policy release_policy_read on release_policy
  for select to anon, authenticated
  using (true);

-- Writes are service role only. No policy grants insert, update or delete.

insert into release_policy (platform, minimum_supported_version, recommended_version)
values
  ('ios',     '1.0.0', '1.0.0'),
  ('android', '1.0.0', '1.0.0'),
  ('web',     '1.0.0', '1.0.0');
