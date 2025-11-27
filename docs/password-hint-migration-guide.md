# パスワードヒント機能のマイグレーション手順

`password_hint`カラムがデータベースに存在しない場合の対処方法を説明します。

## エラー内容

```
エラー: Could not find the 'password_hint' column of 'users' in the schema cache
```

このエラーは、`users`テーブルに`password_hint`カラムがまだ追加されていないことを示しています。

## 解決方法

Supabase管理画面のSQL Editorでマイグレーションを実行してください。

### ステップ1: Supabase管理画面にアクセス

1. https://supabase.com にアクセス
2. プロジェクトを選択
3. 左メニューから **SQL Editor** をクリック

### ステップ2: マイグレーション1を実行（カラム追加）

1. **New query** をクリック
2. 以下のSQLをコピーしてエディタに貼り付け：

```sql
-- Add password_hint column to users table
-- This allows users to set a password hint for password recovery without email

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hint TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_hint ON users(password_hint) WHERE password_hint IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.password_hint IS 'Password hint for password recovery. Users can set a hint (e.g., "childhood car") and use it along with email to reset password without email verification.';
```

3. **Run** をクリック
4. 成功メッセージを確認

### ステップ3: マイグレーション2を実行（JSONB形式に変更）

1. **New query** をクリック（または新しいタブを開く）
2. 以下のSQLをコピーしてエディタに貼り付け：

```sql
-- Update password_hint column to support question and answer format
-- Change from TEXT to JSONB to store both question and answer

-- First, migrate existing data if any exists
-- If password_hint is a simple text, convert it to JSON format
UPDATE users 
SET password_hint = jsonb_build_object(
  'question', password_hint,
  'answer', ''
)
WHERE password_hint IS NOT NULL 
  AND password_hint != ''
  AND password_hint::text NOT LIKE '{%';

-- Change column type to JSONB
ALTER TABLE users 
  ALTER COLUMN password_hint TYPE JSONB 
  USING CASE 
    WHEN password_hint IS NULL THEN NULL
    WHEN password_hint::text LIKE '{%' THEN password_hint::jsonb
    ELSE jsonb_build_object('question', password_hint::text, 'answer', '')
  END;

-- Add comment
COMMENT ON COLUMN users.password_hint IS 'Password hint in JSON format: {"question": "質問", "answer": "答え"}. Used for password recovery without email verification.';
```

3. **Run** をクリック
4. 成功メッセージを確認

### ステップ4: 動作確認

1. アプリケーションをリロード
2. 設定ページを開く
3. 「パスワードヒント（質問と答え）」セクションが表示されることを確認
4. 質問と答えを入力して保存できることを確認

## トラブルシューティング

### エラー: "column already exists"

`password_hint`カラムが既に存在する場合、ステップ2をスキップしてステップ3のみを実行してください。

### エラー: "cannot cast type text to jsonb"

既存のデータがある場合、まず以下のSQLを実行してからステップ3を実行してください：

```sql
-- 既存のTEXTデータをクリア（必要に応じて）
UPDATE users SET password_hint = NULL WHERE password_hint IS NOT NULL;
```

### マイグレーションが完了しない

1. Supabase管理画面の **Database** → **Tables** → **users** を確認
2. `password_hint`カラムが存在するか確認
3. カラムの型が `jsonb` になっているか確認

## まとめ

1. ✅ Supabase管理画面のSQL Editorを開く
2. ✅ ステップ2のSQLを実行（カラム追加）
3. ✅ ステップ3のSQLを実行（JSONB形式に変更）
4. ✅ アプリケーションをリロードして動作確認

マイグレーションが完了すると、パスワードヒント機能が正常に動作するようになります。

