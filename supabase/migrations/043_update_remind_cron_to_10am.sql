-- 退勤漏れリマインドのcronジョブ時刻変更
-- 毎日12:00 JST → 10:00 JST（UTC 1:00）に変更

-- 既存のジョブを削除
SELECT cron.unschedule('remind-incomplete-attendance')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'remind-incomplete-attendance'
);

-- 新しい時刻でスケジュール
SELECT cron.schedule(
  'remind-incomplete-attendance',
  '0 1 * * *',  -- 毎日UTC 1:00 = JST 10:00
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
