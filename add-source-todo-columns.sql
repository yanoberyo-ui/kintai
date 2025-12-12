-- daily_schedulesテーブルにTodo元情報を追加
ALTER TABLE daily_schedules 
ADD COLUMN IF NOT EXISTS source_todo_id UUID,
ADD COLUMN IF NOT EXISTS source_type TEXT; -- 'today', 'weekly', 'routine'

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_daily_schedules_source ON daily_schedules(source_todo_id, source_type);
