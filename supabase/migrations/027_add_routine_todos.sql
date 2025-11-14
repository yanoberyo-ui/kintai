-- 定常TODOテーブルを作成
CREATE TABLE IF NOT EXISTS routine_todos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 定常TODOの完了記録テーブル（日付ごとの完了状態を記録）
CREATE TABLE IF NOT EXISTS routine_todo_completions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  routine_todo_id UUID NOT NULL REFERENCES routine_todos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(routine_todo_id, completed_date)
);

-- インデックス作成
CREATE INDEX idx_routine_todos_user_id ON routine_todos(user_id);
CREATE INDEX idx_routine_todos_order ON routine_todos(user_id, order_index);
CREATE INDEX idx_routine_todo_completions_routine_todo_id ON routine_todo_completions(routine_todo_id);
CREATE INDEX idx_routine_todo_completions_date ON routine_todo_completions(completed_date);

-- RLSポリシー設定
ALTER TABLE routine_todos ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_todo_completions ENABLE ROW LEVEL SECURITY;

-- routine_todosのポリシー
CREATE POLICY "Users can view their own routine todos"
ON routine_todos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own routine todos"
ON routine_todos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own routine todos"
ON routine_todos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routine todos"
ON routine_todos FOR DELETE
USING (auth.uid() = user_id);

-- routine_todo_completionsのポリシー
CREATE POLICY "Users can view their own routine todo completions"
ON routine_todo_completions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own routine todo completions"
ON routine_todo_completions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own routine todo completions"
ON routine_todo_completions FOR DELETE
USING (auth.uid() = user_id);

-- コメント追加
COMMENT ON TABLE routine_todos IS '定常TODO（毎日繰り返すタスク）';
COMMENT ON TABLE routine_todo_completions IS '定常TODOの日付ごとの完了記録';
