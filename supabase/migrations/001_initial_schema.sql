-- FDGroup勤怠管理システム
-- データベース初期スキーマ
-- 作成日: 2025-11-11

-- ============================================================
-- 1. usersテーブル
-- ============================================================

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);

-- ============================================================
-- 2. attendancesテーブル
-- ============================================================

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

-- ============================================================
-- 3. attendance_logsテーブル（監査ログ）
-- ============================================================

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

-- ============================================================
-- 4. todo_listsテーブル
-- ============================================================

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

-- ============================================================
-- 5. todo_itemsテーブル
-- ============================================================

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

-- ============================================================
-- 6. Row Level Security (RLS) ポリシー
-- ============================================================

-- usersテーブル
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- attendancesテーブル
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own attendance"
  ON attendances FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all attendance"
  ON attendances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- attendance_logsテーブル
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs"
  ON attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- todo_listsテーブル
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own todo lists"
  ON todo_lists FOR ALL
  USING (user_id = auth.uid());

-- todo_itemsテーブル
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own todo items"
  ON todo_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todo_items.todo_list_id
      AND todo_lists.user_id = auth.uid()
    )
  );

-- ============================================================
-- 7. 自動更新トリガー（updated_at）
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendances_updated_at BEFORE UPDATE ON attendances
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_lists_updated_at BEFORE UPDATE ON todo_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_todo_items_updated_at BEFORE UPDATE ON todo_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 8. テストデータ挿入（開発用）
-- ============================================================

-- テストユーザー
INSERT INTO users (email, name, employee_id, role, department) VALUES
  ('admin@fdgroup.com', '管理者', 'EMP001', 'admin', '管理部'),
  ('yamada@fdgroup.com', '山田太郎', 'EMP002', 'user', '開発部'),
  ('sato@fdgroup.com', '佐藤花子', 'EMP003', 'user', '営業部');

-- 完了
SELECT 'Database schema created successfully!' as status;
