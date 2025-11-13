-- お知らせの削除ポリシーを追加
-- 投稿者本人または管理者のみが削除可能

DROP POLICY IF EXISTS "Users can delete their own announcements" ON announcements;
DROP POLICY IF EXISTS "Users can delete their own announcements or admins can delete any" ON announcements;
CREATE POLICY "Users can delete their own announcements or admins can delete any" ON announcements
  FOR DELETE
  USING (
    auth.uid() = author_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- お知らせの更新ポリシーも追加（投稿者本人または管理者のみ）
DROP POLICY IF EXISTS "Users can update their own announcements" ON announcements;
DROP POLICY IF EXISTS "Users can update their own announcements or admins can update any" ON announcements;
CREATE POLICY "Users can update their own announcements or admins can update any" ON announcements
  FOR UPDATE
  USING (
    auth.uid() = author_id OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

COMMENT ON POLICY "Users can delete their own announcements or admins can delete any" ON announcements IS '投稿者本人または管理者のみお知らせを削除可能';
COMMENT ON POLICY "Users can update their own announcements or admins can update any" ON announcements IS '投稿者本人または管理者のみお知らせを更新可能';
