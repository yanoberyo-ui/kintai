-- 日次ランキングテーブル
CREATE TABLE IF NOT EXISTS daily_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank INTEGER NOT NULL,
  score DECIMAL(10, 2) NOT NULL,
  task_count INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  completion_rate INTEGER NOT NULL DEFAULT 0,
  snapshot_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1日1ユーザー1レコードの制約
  UNIQUE(date, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_daily_rankings_date ON daily_rankings(date);
CREATE INDEX IF NOT EXISTS idx_daily_rankings_user_date ON daily_rankings(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_rankings_rank ON daily_rankings(date, rank);

-- RLS (Row Level Security) 設定
ALTER TABLE daily_rankings ENABLE ROW LEVEL SECURITY;

-- 全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view daily rankings" ON daily_rankings;
CREATE POLICY "Anyone can view daily rankings" ON daily_rankings
  FOR SELECT
  USING (true);

-- システム（サービスロール）のみ作成・更新可能
DROP POLICY IF EXISTS "Service role can manage daily rankings" ON daily_rankings;
CREATE POLICY "Service role can manage daily rankings" ON daily_rankings
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role'
  );
