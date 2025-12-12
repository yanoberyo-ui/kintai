-- =====================================================
-- 不足しているテーブルを作成するSQL
-- Supabase の SQL Editor で実行してください
-- =====================================================

-- 1. 週次タスクテーブル（今週のタスク機能用）
CREATE TABLE IF NOT EXISTS weekly_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weekly_tasks_user_id ON weekly_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_tasks_deadline ON weekly_tasks(deadline);

ALTER TABLE weekly_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage own weekly tasks" ON weekly_tasks;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Users can manage own weekly tasks" ON weekly_tasks
  FOR ALL USING (auth.uid() = user_id);

-- 2. 日毎スケジュールテーブル（日毎カレンダー機能用）
CREATE TABLE IF NOT EXISTS daily_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_schedules_user_id ON daily_schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_daily_schedules_start_time ON daily_schedules(start_time);

ALTER TABLE daily_schedules ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can manage own schedules" ON daily_schedules;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view all schedules" ON daily_schedules;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

CREATE POLICY "Users can manage own schedules" ON daily_schedules
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view all schedules" ON daily_schedules
  FOR SELECT USING (true);

-- =====================================================
-- 実行完了後、アプリをリロードしてください
-- =====================================================
