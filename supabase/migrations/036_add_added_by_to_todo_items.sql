-- todo_itemsテーブルにadded_byカラムを追加
-- タスクを追加したユーザーを記録するため

-- added_byカラムを追加
ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS added_by UUID REFERENCES users(id);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_todo_items_added_by ON todo_items(added_by);

-- RLSポリシーの更新：メンバーページで他のユーザーのTODOも閲覧・編集可能に
-- ただし削除は制限（added_byが自分のものだけ削除可能）

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can manage own todo items" ON todo_items;
DROP POLICY IF EXISTS "Users can view and edit own todo items" ON todo_items;
DROP POLICY IF EXISTS "Users can insert into own todo lists" ON todo_items;
DROP POLICY IF EXISTS "Users can update todo items in own lists" ON todo_items;
DROP POLICY IF EXISTS "Users can delete own added items" ON todo_items;
DROP POLICY IF EXISTS "Admins can manage all todo items" ON todo_items;
DROP POLICY IF EXISTS "All users can view todo items" ON todo_items;
DROP POLICY IF EXISTS "All users can insert todo items" ON todo_items;
DROP POLICY IF EXISTS "All users can update todo items" ON todo_items;
DROP POLICY IF EXISTS "Users can delete own items or own added items" ON todo_items;
-- 005_allow_read_all_attendance.sqlで作成されたポリシーを削除
DROP POLICY IF EXISTS "All authenticated users can read all todo items" ON todo_items;
DROP POLICY IF EXISTS "Users can insert own todo items" ON todo_items;
DROP POLICY IF EXISTS "Users can update own todo items" ON todo_items;
DROP POLICY IF EXISTS "Users can delete own todo items" ON todo_items;

-- SELECT: 全ユーザーが全TODOアイテムを閲覧可能（メンバーページ用）
CREATE POLICY "All users can view todo items"
  ON todo_items FOR SELECT
  USING (true);

-- INSERT: 全ユーザーが全todo_listにアイテムを追加可能（メンバーページで他人のTODOにも追加できる）
CREATE POLICY "All users can insert todo items"
  ON todo_items FOR INSERT
  WITH CHECK (true);

-- UPDATE: 全ユーザーが全TODOアイテムを更新可能（チェックの切り替え等）
CREATE POLICY "All users can update todo items"
  ON todo_items FOR UPDATE
  USING (true);

-- DELETE: 以下の条件でのみ削除可能
-- 1. 自分のリストのアイテム（todo_lists.user_id = auth.uid()）で、かつ
--    (added_byが自分、またはadded_byがNULL)
-- 2. 自分が追加したアイテム（added_by = auth.uid()）は常に削除可能
CREATE POLICY "Users can delete own items or own added items"
  ON todo_items FOR DELETE
  USING (
    -- 自分のTODOリストのアイテムで、自分が追加した or added_byがない場合
    (
      EXISTS (
        SELECT 1 FROM todo_lists
        WHERE todo_lists.id = todo_items.todo_list_id
        AND todo_lists.user_id = auth.uid()
      )
      AND (added_by IS NULL OR added_by = auth.uid())
    )
    -- または、自分が追加したアイテム（他人のリストでも削除可能）
    OR added_by = auth.uid()
  );

-- 管理者は全てのtodo_itemsを操作可能
CREATE POLICY "Admins can manage all todo items"
  ON todo_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 完了
SELECT 'Added added_by column to todo_items!' as status;

