-- routine_todosテーブルにindent_levelカラムを追加
ALTER TABLE routine_todos ADD COLUMN IF NOT EXISTS indent_level INTEGER NOT NULL DEFAULT 0;
