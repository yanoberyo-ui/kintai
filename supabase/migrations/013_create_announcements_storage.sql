-- お知らせ画像用のStorageバケット作成
INSERT INTO storage.buckets (id, name, public)
VALUES ('announcements', 'announcements', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS設定

-- 全員が画像を閲覧可能
DROP POLICY IF EXISTS "Anyone can view announcement images" ON storage.objects;
CREATE POLICY "Anyone can view announcement images"
ON storage.objects FOR SELECT
USING (bucket_id = 'announcements');

-- 認証済みユーザーは誰でも画像をアップロード可能
DROP POLICY IF EXISTS "Authenticated users can upload announcement images" ON storage.objects;
CREATE POLICY "Authenticated users can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'announcements' AND
  auth.uid() IS NOT NULL
);

-- 認証済みユーザーは誰でも画像を更新可能
DROP POLICY IF EXISTS "Authenticated users can update announcement images" ON storage.objects;
CREATE POLICY "Authenticated users can update announcement images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'announcements' AND
  auth.uid() IS NOT NULL
);

-- 認証済みユーザーは誰でも画像を削除可能
DROP POLICY IF EXISTS "Authenticated users can delete announcement images" ON storage.objects;
CREATE POLICY "Authenticated users can delete announcement images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'announcements' AND
  auth.uid() IS NOT NULL
);
