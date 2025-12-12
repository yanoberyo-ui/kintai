-- Googleカレンダー連携用カラムを追加

-- usersテーブルにGoogleトークン情報を追加
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS google_access_token TEXT,
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS google_calendar_enabled BOOLEAN DEFAULT false;

-- daily_schedulesテーブルにGoogleイベントIDを追加
ALTER TABLE daily_schedules
ADD COLUMN IF NOT EXISTS google_event_id TEXT,
ADD COLUMN IF NOT EXISTS synced_from_google BOOLEAN DEFAULT false;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_daily_schedules_google_event_id ON daily_schedules(google_event_id);
CREATE INDEX IF NOT EXISTS idx_users_google_calendar ON users(google_calendar_enabled) WHERE google_calendar_enabled = true;
