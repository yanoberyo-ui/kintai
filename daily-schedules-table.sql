-- 日毎スケジュールテーブル
CREATE TABLE IF NOT EXISTS daily_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_daily_schedules_user_id ON daily_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_start_time ON daily_schedules(start_time);

-- RLSを有効化
ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;

-- 自分のスケジュールは全操作可能
CREATE POLICY "Users can manage own schedules" ON daily_schedules
  FOR ALL USING (auth.uid() = user_id);

-- 他ユーザーのスケジュールは閲覧のみ
CREATE POLICY "Users can view all schedules" ON daily_schedules
  FOR SELECT USING (true);
