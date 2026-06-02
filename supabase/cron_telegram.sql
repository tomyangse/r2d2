-- ============================================
-- R2D Telegram Reminders — Cron Job Setup
-- Run this in Supabase SQL Editor
-- Prerequisites: pg_cron, pg_net, vault extensions enabled
-- ============================================

-- NOTE: Vault secrets (project_url, supabase_anon_key) should
-- already exist from cron_push.sql setup. If not, run:
-- SELECT vault.create_secret('https://ihgeofvvqcfobqbepjds.supabase.co', 'project_url');
-- SELECT vault.create_secret('YOUR_ANON_KEY', 'supabase_anon_key');

-- Schedule: every minute, call the send-telegram Edge Function
SELECT cron.schedule(
  'send-telegram-reminders',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/send-telegram',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Useful commands:
-- List jobs:       SELECT * FROM cron.job;
-- Check history:   SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
-- Remove job:      SELECT cron.unschedule('send-telegram-reminders');
