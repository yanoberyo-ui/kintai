-- FDGroup 勤怠管理システム - Supabase テーブル作成SQL
-- 実行順序: このファイルを上から順番にSupabase SQL Editorで実行してください

-- ============================================
-- 1. users テーブル (ユーザー情報)
-- ============================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  slack_id VARCHAR(50) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_slack_id ON users(slack_id);

-- ============================================
-- 2. attendances テーブル (勤怠記録)
-- ============================================
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_sessions JSONB DEFAULT '[]'::jsonb,
  break_minutes_used INTEGER DEFAULT 0,
  total_work_minutes INTEGER DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'working' CHECK (status IN ('working', 'completed', 'absent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- インデックス
CREATE INDEX idx_attendances_user_id ON attendances(user_id);
CREATE INDEX idx_attendances_date ON attendances(date);
CREATE INDEX idx_attendances_status ON attendances(status);
CREATE INDEX idx_attendances_user_date ON attendances(user_id, date);

-- ============================================
-- 3. attendance_logs テーブル (打刻履歴・監査ログ)
-- ============================================
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'clock_in', 'clock_out', 'break_start', 'break_end', 'edit', 'delete'
  )),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_by UUID REFERENCES users(id),
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_attendance_logs_attendance_id ON attendance_logs(attendance_id);
CREATE INDEX idx_attendance_logs_timestamp ON attendance_logs(timestamp);
CREATE INDEX idx_attendance_logs_action_type ON attendance_logs(action_type);

-- ============================================
-- 4. todo_lists テーブル (TODOリスト)
-- ============================================
CREATE TABLE todo_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title VARCHAR(100) DEFAULT '今日のtodo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- インデックス
CREATE INDEX idx_todo_lists_user_id ON todo_lists(user_id);
CREATE INDEX idx_todo_lists_date ON todo_lists(date);
CREATE INDEX idx_todo_lists_user_date ON todo_lists(user_id, date);

-- ============================================
-- 5. todo_items テーブル (TODOアイテム)
-- ============================================
CREATE TABLE todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_todo_items_list_id ON todo_items(todo_list_id);
CREATE INDEX idx_todo_items_order ON todo_items(todo_list_id, order_index);

-- ============================================
-- 6. Row Level Security (RLS) ポリシー設定
-- ============================================

-- usersテーブルのRLS有効化
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の情報のみ閲覧可能
CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- 管理者は全員閲覧可能
CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 新規ユーザーは自分のレコードを作成可能（サインアップ時）
CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- attendancesテーブルのRLS有効化
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の勤怠のみ操作可能
CREATE POLICY "Users can manage own attendance"
  ON attendances FOR ALL
  USING (user_id = auth.uid());

-- 管理者は全員操作可能
CREATE POLICY "Admins can manage all attendance"
  ON attendances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- attendance_logsテーブルのRLS有効化
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- 管理者のみ閲覧可能
CREATE POLICY "Admins can view logs"
  ON attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- システムによる自動ログ挿入を許可
CREATE POLICY "System can insert logs"
  ON attendance_logs FOR INSERT
  WITH CHECK (true);

-- todo_listsテーブルのRLS有効化
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のTODOリストのみ操作可能
CREATE POLICY "Users can manage own todo lists"
  ON todo_lists FOR ALL
  USING (user_id = auth.uid());

-- todo_itemsテーブルのRLS有効化
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分のTODOアイテムのみ操作可能
CREATE POLICY "Users can manage own todo items"
  ON todo_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todo_items.todo_list_id
      AND todo_lists.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. updated_at自動更新トリガー
-- ============================================

-- トリガー関数の作成
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを設定
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendances_updated_at
  BEFORE UPDATE ON attendances
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_lists_updated_at
  BEFORE UPDATE ON todo_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_items_updated_at
  BEFORE UPDATE ON todo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. テストデータ（オプション）
-- ============================================
-- 実際のユーザーは Supabase Auth で作成されるため、
-- ここでは users テーブルに直接挿入しません。
-- Supabase Auth でユーザーを作成後、自動的にこのテーブルと連携されます。
