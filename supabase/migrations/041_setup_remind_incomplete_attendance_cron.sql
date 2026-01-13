-- 退勤漏れリマインドのcronジョブ設定
-- 毎日12:00 JST（UTC 3:00）に実行

-- 既存のジョブがあれば削除
SELECT cron.unschedule('remind-incomplete-attendance')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'remind-incomplete-attendance'
);

-- 新しいジョブをスケジュール
SELECT cron.schedule(
  'remind-incomplete-attendance',
  '0 3 * * *',  -- 毎日UTC 3:00 = JST 12:00
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/remind-incomplete-attendance',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'supabase_anon_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);
