-- 粗利自動インポート用のCron Job設定
-- 毎日朝9時（日本時間）にスプレッドシートからデータをインポート

-- Cron Job用の関数を作成
CREATE OR REPLACE FUNCTION trigger_revenue_import()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_year INTEGER;
  current_month INTEGER;
BEGIN
  -- 現在の年月を取得
  current_year := EXTRACT(YEAR FROM CURRENT_DATE);
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Edge Functionを呼び出す
  PERFORM net.http_post(
    url := current_setting('app.supabase_url') || '/functions/v1/import-revenue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key')
    ),
    body := jsonb_build_object(
      'year', current_year,
      'month', current_month
    )
  );
END;
$$;

-- Cron Jobをスケジュール（毎日朝9時JST = 0時UTC）
SELECT cron.schedule(
  'daily-revenue-import',
  '0 0 * * *', -- 毎日0時UTC（日本時間9時）
  $$SELECT trigger_revenue_import()$$
);

-- 設定を保存するためのテーブルを作成（もし必要なら）
COMMENT ON FUNCTION trigger_revenue_import() IS '毎日自動的にスプレッドシートから粗利データをインポートする';
