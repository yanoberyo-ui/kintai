-- usersテーブルのINSERTポリシーを追加（既存のポリシーがある場合は削除して再作成）

-- 既存のポリシーを削除（エラーが出ても無視）
DROP POLICY IF EXISTS "Users can insert own data" ON users;

-- 新しいポリシーを作成
CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 確認用：現在のポリシー一覧を表示
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'users';
