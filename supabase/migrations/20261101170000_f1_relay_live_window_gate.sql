-- =============================================================================
-- f1-signalr-relay: live-window cron gate + cron/pg_net housekeeping
-- =============================================================================
-- Context (1 Nov 2026 outage): the old relay cron ran every minute, 24/7, with
-- no live-session check. Every run added a row to cron.job_run_details and a
-- response to net._http_response (133 MB + 143 MB), which exhausted the Disk IO
-- budget. This migration:
--   1. reschedules the relay cron so it only calls net.http_post while the
--      kv_cache row 'f1_live_window' (written hourly by check-f1-results) says a
--      Race or Sprint is on;
--   2. purges cron.job_run_details older than 2 days, daily;
--   3. purges net._http_response older than 1 hour, hourly.
--
-- Secrets are never stored in this file. The X-Cron-Secret value is read at run
-- time from Supabase Vault (secret name 'cron_secret'), falling back to the
-- database setting app.settings.cron_secret if that is how the project stores it.
-- Before applying, check how the existing hourly job reads its secret:
--   select command from cron.job where jobname = 'check-f1-results-job';
-- and, if needed, create the Vault secret once in the SQL editor (not in git):
--   select vault.create_secret('<CRON_SECRET value>', 'cron_secret');
-- =============================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Helper: true while now() is inside one of the published Race/Sprint windows.
-- Value shape: {"windows":[{"label":"...","start":"<iso>","end":"<iso>"}], ...}
create or replace function public.f1_live_window_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.kv_cache c,
         jsonb_array_elements(coalesce(c.value -> 'windows', '[]'::jsonb)) as w
    where c.key = 'f1_live_window'
      and (w ->> 'start')::timestamptz <= now()
      and now() < (w ->> 'end')::timestamptz
  );
$$;

revoke all on function public.f1_live_window_open() from public, anon, authenticated;

-- Helper: resolve the cron secret without hard-coding it.
create or replace function public.f1_cron_secret()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_secret text;
begin
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'cron_secret'
    limit 1;
  exception when others then
    v_secret := null; -- vault not available
  end;
  return coalesce(v_secret, nullif(current_setting('app.settings.cron_secret', true), ''));
end;
$$;

revoke all on function public.f1_cron_secret() from public, anon, authenticated;

-- Seed an empty window so the gate is closed until check-f1-results publishes one.
insert into public.kv_cache (key, value, updated_at)
values ('f1_live_window', jsonb_build_object('windows', '[]'::jsonb, 'source', 'migration'), now())
on conflict (key) do nothing;

-- Remove any previous definition of the relay job (it was unscheduled on 1 Nov 2026).
select cron.unschedule(jobid) from cron.job where jobname = 'f1-signalr-relay-cron';

-- 1. Relay, every minute, but net.http_post only fires inside a live window.
--    The function answers 202 immediately and relays in the background (~55 s),
--    so a short pg_net timeout is fine.
select cron.schedule(
  'f1-signalr-relay-cron',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://cpfhwfomcautyutiaeah.supabase.co/functions/v1/f1-signalr-relay',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', public.f1_cron_secret()
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  )
  where public.f1_live_window_open();
  $cron$
);

-- 2. Daily purge of pg_cron run history.
select cron.unschedule(jobid) from cron.job where jobname = 'purge-cron-job-run-details';
select cron.schedule(
  'purge-cron-job-run-details',
  '17 3 * * *',
  $cron$ delete from cron.job_run_details where end_time < now() - interval '2 days'; $cron$
);

-- 3. Hourly purge of stored pg_net responses (pg_net's own TTL defaults to 6 hours;
--    changing pg_net.ttl needs ALTER SYSTEM / a dashboard or support change, see PR notes).
select cron.unschedule(jobid) from cron.job where jobname = 'purge-net-http-response';
select cron.schedule(
  'purge-net-http-response',
  '41 * * * *',
  $cron$ delete from net._http_response where created < now() - interval '1 hour'; $cron$
);
