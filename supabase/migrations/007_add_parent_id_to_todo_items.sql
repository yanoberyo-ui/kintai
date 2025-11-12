-- TODOアイテムに親子関係を追加
-- 作成日: 2025-11-12

-- ============================================================
-- 1. todo_itemsテーブルにparent_idカラムを追加
-- ============================================================

ALTER TABLE todo_items
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES todo_items(id) ON DELETE CASCADE;

-- インデックスを追加してクエリパフォーマンスを向上
CREATE INDEX IF NOT EXISTS idx_todo_items_parent_id ON todo_items(parent_id);

-- 完了
SELECT 'Parent-child relationship added to todo_items successfully!' as status;
