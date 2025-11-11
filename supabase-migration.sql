-- 既存のusersテーブルをemployee_idからslack_idに変更するマイグレーション

-- 1. employee_idカラムをslack_idにリネーム
ALTER TABLE users RENAME COLUMN employee_id TO slack_id;

-- 2. インデックスを削除して再作成
DROP INDEX IF EXISTS idx_users_employee_id;
CREATE INDEX idx_users_slack_id ON users(slack_id);

-- 3. 新規登録用のRLSポリシーを追加
CREATE POLICY "Users can insert own data"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);
-- 開発環境でのみ実行してください
  ALTER TABLE users DISABLE ROW LEVEL SECURITY;

  