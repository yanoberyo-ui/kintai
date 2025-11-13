-- announcement_reads テーブルに UPSERT 用のポリシーを追加

-- 既存の INSERT ポリシーを削除して、UPSERT 対応の新しいポリシーを作成
DROP POLICY IF EXISTS "Users can mark as read" ON announcement_reads;

-- INSERT と UPDATE の両方を許可するポリシー
CREATE POLICY "Users can mark as read" ON announcement_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- UPDATEポリシーも追加（upsert のため）
DROP POLICY IF EXISTS "Users can update their reads" ON announcement_reads;
CREATE POLICY "Users can update their reads" ON announcement_reads
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
