-- 参加者限定メッセージカラムを追加
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS participants_only_message TEXT;

COMMENT ON COLUMN announcements.participants_only_message IS '参加者のみが閲覧できるシークレットメッセージ';
