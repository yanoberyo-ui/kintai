-- メンバーページで全員の勤怠状態を表示できるようにRLSポリシーを修正
-- 作成日: 2025-11-12

-- ============================================================
-- 1. usersテーブル: 全ユーザーが全員のユーザー情報を読み取れるように
-- ============================================================

-- 既存の制限的なポリシーを削除
DROP POLICY IF EXISTS "Users can view own data" ON users;

-- 全ユーザーが全員のユーザー情報を読み取れるポリシーを追加
CREATE POLICY "All authenticated users can view all users"
  ON users FOR SELECT
  USING (auth.role() = 'authenticated');

-- 管理者ポリシーはそのまま残す（既に存在）

-- ============================================================
-- 2. attendancesテーブル: 読み取りは全員可、書き込みは本人のみ
-- ============================================================

-- 既存の制限的なポリシーを削除
DROP POLICY IF EXISTS "Users can manage own attendance" ON attendances;

-- 全ユーザーが全員の勤怠データを読み取れるポリシーを追加
CREATE POLICY "All authenticated users can read all attendance"
  ON attendances FOR SELECT
  USING (auth.role() = 'authenticated');

-- 自分の勤怠データの書き込み・更新・削除は本人のみ
CREATE POLICY "Users can insert own attendance"
  ON attendances FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own attendance"
  ON attendances FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own attendance"
  ON attendances FOR DELETE
  USING (user_id = auth.uid());

-- 管理者ポリシーはそのまま残す（既に存在）

-- ============================================================
-- 3. todo_listsテーブル: 読み取りは全員可、書き込みは本人のみ
-- ============================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can manage own todo lists" ON todo_lists;

-- 全ユーザーが全員のTODOリストを読み取れるポリシーを追加
CREATE POLICY "All authenticated users can read all todo lists"
  ON todo_lists FOR SELECT
  USING (auth.role() = 'authenticated');

-- 自分のTODOリストの書き込み・更新・削除は本人のみ
CREATE POLICY "Users can insert own todo lists"
  ON todo_lists FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own todo lists"
  ON todo_lists FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own todo lists"
  ON todo_lists FOR DELETE
  USING (user_id = auth.uid());

-- ============================================================
-- 4. todo_itemsテーブル: 読み取りは全員可、書き込みは本人のみ
-- ============================================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Users can manage own todo items" ON todo_items;

-- 全ユーザーが全員のTODOアイテムを読み取れるポリシーを追加
CREATE POLICY "All authenticated users can read all todo items"
  ON todo_items FOR SELECT
  USING (auth.role() = 'authenticated');

-- 自分のTODOアイテムの書き込み・更新・削除は本人のみ
CREATE POLICY "Users can insert own todo items"
  ON todo_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todo_items.todo_list_id
      AND todo_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own todo items"
  ON todo_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todo_items.todo_list_id
      AND todo_lists.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own todo items"
  ON todo_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todo_items.todo_list_id
      AND todo_lists.user_id = auth.uid()
    )
  );

-- 完了
SELECT 'RLS policies updated successfully! All users can now view each other''s data.' as status;
