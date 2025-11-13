-- いいねテーブル
CREATE TABLE IF NOT EXISTS announcement_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1つのお知らせに1ユーザー1回のみいいね
  UNIQUE(announcement_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_announcement_likes_announcement ON announcement_likes(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_likes_user ON announcement_likes(user_id);

-- RLS (Row Level Security) 設定
ALTER TABLE announcement_likes ENABLE ROW LEVEL SECURITY;

-- いいねは全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view likes" ON announcement_likes;
CREATE POLICY "Anyone can view likes" ON announcement_likes
  FOR SELECT
  USING (true);

-- いいねは本人のみ可能
DROP POLICY IF EXISTS "Users can like" ON announcement_likes;
CREATE POLICY "Users can like" ON announcement_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- いいね取り消しは本人のみ可能
DROP POLICY IF EXISTS "Users can unlike" ON announcement_likes;
CREATE POLICY "Users can unlike" ON announcement_likes
  FOR DELETE
  USING (auth.uid() = user_id);
