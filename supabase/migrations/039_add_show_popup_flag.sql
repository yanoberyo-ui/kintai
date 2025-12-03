-- お知らせにポップアップ表示フラグを追加
-- show_popup: trueの場合、未読ユーザーにポップアップで表示

ALTER TABLE announcements 
ADD COLUMN IF NOT EXISTS show_popup BOOLEAN DEFAULT true;

-- 既存のお知らせは全てポップアップ表示をONに
UPDATE announcements SET show_popup = true WHERE show_popup IS NULL;

COMMENT ON COLUMN announcements.show_popup IS 'ポップアップで表示するかどうか（true: 表示する, false: しない）';

