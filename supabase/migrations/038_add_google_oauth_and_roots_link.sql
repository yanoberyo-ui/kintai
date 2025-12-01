-- Google OAuth認証 & roots_dev連携用マイグレーション
-- 作成日: 2025-12-01

-- ============================================================
-- 1. usersテーブルにGoogle OAuth関連カラムを追加
-- ============================================================

-- google_id: Google OAuthのユーザーID
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;

-- image: プロフィール画像URL（Google OAuth由来）
ALTER TABLE users ADD COLUMN IF NOT EXISTS image TEXT;

-- roots_user_id: roots_devでのユーザーID（連携用）
ALTER TABLE users ADD COLUMN IF NOT EXISTS roots_user_id VARCHAR(255) UNIQUE;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_roots_user_id ON users(roots_user_id);

-- ============================================================
-- 2. roots_dev連携用テーブル: todo_sync_items
--    roots_devからインポートされたTODOを追跡
-- ============================================================

CREATE TABLE IF NOT EXISTS roots_todo_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- kintai-dev側のID
  kintai_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kintai_todo_item_id UUID REFERENCES todo_items(id) ON DELETE SET NULL,
  
  -- roots_dev側のID
  roots_todo_id VARCHAR(255) NOT NULL,
  roots_objective_id VARCHAR(255),
  roots_objective_title TEXT,
  
  -- 同期状態
  sync_direction VARCHAR(20) DEFAULT 'from_roots' CHECK (sync_direction IN ('from_roots', 'to_roots', 'bidirectional')),
  last_synced_at TIMESTAMPTZ DEFAULT NOW(),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(kintai_user_id, roots_todo_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_roots_todo_sync_user ON roots_todo_sync(kintai_user_id);
CREATE INDEX IF NOT EXISTS idx_roots_todo_sync_roots_todo ON roots_todo_sync(roots_todo_id);

-- RLSポリシー
ALTER TABLE roots_todo_sync ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own roots sync"
  ON roots_todo_sync FOR ALL
  USING (kintai_user_id = auth.uid());

-- 更新トリガー
CREATE TRIGGER update_roots_todo_sync_updated_at BEFORE UPDATE ON roots_todo_sync
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 3. 完了
-- ============================================================

SELECT 'Google OAuth and roots_dev link migration completed!' as status;

