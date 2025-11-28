-- 毎朝9:00（日本時間）に時間あたり採算レポートをSlackに送信するcronジョブを設定

-- pg_cron拡張を有効化（すでに有効な場合はスキップ）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 既存のcronジョブを削除（あれば）
DO $$
BEGIN
  PERFORM cron.unschedule('daily-profitability-report');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- ジョブが存在しない場合はスキップ
END $$;

-- 毎日9:00（日本時間）にレポート送信処理を実行
-- 日本時間9:00 = UTC 0:00
SELECT cron.schedule(
  'daily-profitability-report',
  '0 0 * * *', -- 毎日UTC 0:00 = JST 9:00
  $$
  SELECT
    net.http_post(
      url := (SELECT value FROM app_settings WHERE key = 'supabase_url') || '/functions/v1/daily-profitability-report',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT value FROM app_settings WHERE key = 'supabase_anon_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL - used for daily profitability report';

