-- 退勤漏れチェック用 cron ジョブの設定
-- 毎日深夜0時（JST = UTC 15:00）に check-incomplete-attendance Edge Function を呼び出す

-- pg_cron拡張を有効化（すでに有効な場合はスキップ）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- pg_net拡張を有効化（HTTP リクエスト用）
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 既存のcronジョブを削除（あれば）
DO $$
BEGIN
  PERFORM cron.unschedule('check-incomplete-attendance');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- ジョブが存在しない場合はスキップ
END $$;

-- 毎日深夜0時（日本時間）に退勤漏れチェックを実行
-- 日本時間0:00 = UTC 15:00
SELECT cron.schedule(
  'check-incomplete-attendance',
  '0 15 * * *', -- 毎日UTC 15:00 = JST 0:00
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/check-incomplete-attendance',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'supabase_anon_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS '退勤漏れチェック用ジョブスケジューラ';

