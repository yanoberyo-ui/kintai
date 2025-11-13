-- お知らせにリンクURLカラムを追加
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS link_url TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS link_title TEXT;
