-- =====================================================
-- パスワードリセット試行のレート制限テーブル
-- 15分間に5回までのリセット試行を許可
-- =====================================================

CREATE TABLE IF NOT EXISTS password_reset_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_attempts_email_time
    ON password_reset_attempts(email, attempted_at);

-- 古いレコードを自動削除するポリシー（RLSはサービスロール経由のアクセスのみ）
ALTER TABLE password_reset_attempts ENABLE ROW LEVEL SECURITY;

-- サービスロールのみアクセス可能（Edge Functionから使用）
-- 一般ユーザーからはアクセス不可
