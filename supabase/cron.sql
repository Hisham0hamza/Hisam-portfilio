-- Masar — scheduled jobs (run once in the Supabase SQL editor after deploying).
--
-- Prerequisites:
--   1. Enable the pg_cron and pg_net extensions (Dashboard → Database → Extensions).
--   2. Deploy the push function:   supabase functions deploy send-push
--   3. Store the project URL and service role key in Vault:
--        select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--        select vault.create_secret('<service-role-key>', 'service_role_key');

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 24h / 2h reminders → notification outbox.
select cron.schedule('masar-event-reminders', '*/15 * * * *', $$select public.enqueue_event_reminders()$$);

-- Close events that ended more than 12 hours ago (opens reviews).
select cron.schedule('masar-auto-complete', '0 * * * *', $$select public.auto_complete_events()$$);

-- Deliver the outbox as Expo push notifications every minute.
select cron.schedule('masar-send-push', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
$$);
