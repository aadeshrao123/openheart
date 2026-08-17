-- OpenHeart :: the header the gateway wants, which is not the one the function
-- checks
--
-- 0029 sent Content-Type and X-Push-Secret and nothing else, so every
-- notification since it shipped came back:
--
--   401 {"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization
--        header"}
--
-- and never reached send-push at all. The function was fine. The secret was
-- fine. The request was refused one layer in front of both.
--
-- This is written down in .github/workflows/purge-media.yml, which hit exactly
-- this and says so: X-Purge-Token is what the function checks, Authorization is
-- what the Edge Function gateway demands before the function is reached, and
-- `supabase functions serve` does not enforce it. So it works locally, it works
-- in pgTAP, and it fails only in production.
--
-- The pgTAP test asserted the X-Push-Secret header was correct. It could not
-- have caught this: there is no gateway in front of a local Postgres.
--
-- The anon key is not a secret. It ships inside the web bundle and every copy
-- of the app. It lives in Vault for the same reason the URL does, which is that
-- it differs per environment and this file is public.

create or replace function public.queue_push(recipient uuid, kind text, thread uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  endpoint text;
  secret   text;
  anon     text;
begin
  select decrypted_secret into endpoint
    from vault.decrypted_secrets where name = 'push_function_url';

  select decrypted_secret into secret
    from vault.decrypted_secrets where name = 'push_hook_secret';

  select decrypted_secret into anon
    from vault.decrypted_secrets where name = 'push_function_anon_key';

  if endpoint is null or secret is null or anon is null then
    return;
  end if;

  -- Two headers doing two different jobs. Authorization satisfies the gateway,
  -- which will accept any valid key for this project and proves nothing about
  -- the caller. X-Push-Secret is the check that actually decides, compared at
  -- full length inside the function.
  perform net.http_post(
    url     := endpoint,
    body    := jsonb_build_object('recipient', recipient, 'kind', kind, 'match_id', thread),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon,
      'X-Push-Secret', secret
    )
  );
exception
  when others then
    return;
end;
$$;

revoke all on function public.queue_push(uuid, text, uuid) from public;
