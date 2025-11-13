-- pg_cron拡張を有効化（すでに有効な場合はスキップ）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 既存のcronジョブを削除（あれば）
DO $$
BEGIN
  PERFORM cron.unschedule('finalize-daily-ranking');
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- ジョブが存在しない場合はスキップ
END $$;

-- 毎日19:00（日本時間）にランキング確定処理を実行
-- 日本時間19:00 = UTC 10:00
SELECT cron.schedule(
  'finalize-daily-ranking',
  '0 10 * * *', -- 毎日UTC 10:00 = JST 19:00
  $$
  SELECT
    net.http_post(
      url := (SELECT current_setting('app.settings.supabase_url') || '/functions/v1/finalize-daily-ranking'),
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || (SELECT current_setting('app.settings.supabase_anon_key')),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- 設定を保存するためのテーブル（必要に応じて）
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Supabase URLとAPIキーを保存（実際の値は環境変数から設定）
-- これらは後でSupabase Dashboardから設定してください
INSERT INTO app_settings (key, value) VALUES
  ('supabase_url', 'https://your-project.supabase.co'),
  ('supabase_anon_key', 'your-anon-key')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE app_settings IS 'アプリケーション設定を保存するテーブル';
