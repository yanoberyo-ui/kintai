-- ポモドーロ機能のためのテーブル拡張
-- 作成日: 2025-11-12

-- ============================================================
-- 1. todo_itemsテーブルにpomodoro_countカラムを追加
-- ============================================================

ALTER TABLE todo_items
ADD COLUMN IF NOT EXISTS pomodoro_count INTEGER DEFAULT 0;

-- ============================================================
-- 2. ポモドーロ履歴テーブル（オプション - 詳細な履歴が必要な場合）
-- ============================================================

-- CREATE TABLE IF NOT EXISTS pomodoro_sessions (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   todo_item_id UUID REFERENCES todo_items(id) ON DELETE SET NULL,
--   started_at TIMESTAMPTZ NOT NULL,
--   completed_at TIMESTAMPTZ,
--   duration_minutes INTEGER DEFAULT 25,
--   session_type VARCHAR(20) CHECK (session_type IN ('work', 'short_break', 'long_break')),
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- -- インデックス
-- CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_user_id ON pomodoro_sessions(user_id);
-- CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_todo_item_id ON pomodoro_sessions(todo_item_id);
-- CREATE INDEX IF NOT EXISTS idx_pomodoro_sessions_started_at ON pomodoro_sessions(started_at);

-- -- RLS有効化
-- ALTER TABLE pomodoro_sessions ENABLE ROW LEVEL SECURITY;

-- -- 自分のポモドーロセッションのみ閲覧・管理可能
-- CREATE POLICY "Users can manage own pomodoro sessions"
--   ON pomodoro_sessions FOR ALL
--   USING (user_id = auth.uid());

-- 完了
SELECT 'Pomodoro count column added successfully!' as status;
