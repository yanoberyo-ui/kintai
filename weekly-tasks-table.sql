-- 週次タスクテーブルのみ作成
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

CREATE POLICY "Users can manage own weekly tasks" ON weekly_tasks
  FOR ALL USING (auth.uid() = user_id);
