-- 複数画像対応: image_urls配列カラムを追加
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS image_urls TEXT[];

-- 既存のimage_urlデータをimage_urlsに移行（image_urlがある場合）
UPDATE announcements 
SET image_urls = ARRAY[image_url]
WHERE image_url IS NOT NULL AND (image_urls IS NULL OR array_length(image_urls, 1) IS NULL);

COMMENT ON COLUMN announcements.image_urls IS '投稿に添付された画像URLの配列';

