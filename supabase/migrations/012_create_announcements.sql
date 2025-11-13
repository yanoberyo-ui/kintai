-- お知らせ・イベントテーブル
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('announcement', 'event')),

  -- イベント情報（categoryが'event'の場合のみ使用）
  event_date TIMESTAMPTZ,
  event_location TEXT,
  max_participants INTEGER,

  -- 画像
  image_url TEXT,

  -- 投稿者
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- タイムスタンプ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- イベント参加者テーブル
CREATE TABLE IF NOT EXISTS announcement_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1つのイベントに1ユーザー1回のみ参加
  UNIQUE(announcement_id, user_id)
);

-- コメントテーブル
CREATE TABLE IF NOT EXISTS announcement_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 既読管理テーブル
CREATE TABLE IF NOT EXISTS announcement_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1つのお知らせに1ユーザー1回のみ既読
  UNIQUE(announcement_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_announcements_category ON announcements(category);
CREATE INDEX IF NOT EXISTS idx_announcements_created_at ON announcements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcement_participants_announcement ON announcement_participants(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_participants_user ON announcement_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_announcement_comments_announcement ON announcement_comments(announcement_id);
CREATE INDEX IF NOT EXISTS idx_announcement_reads_user ON announcement_reads(user_id);

-- RLS (Row Level Security) 設定
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads ENABLE ROW LEVEL SECURITY;

-- お知らせは全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view announcements" ON announcements;
CREATE POLICY "Anyone can view announcements" ON announcements
  FOR SELECT
  USING (true);

-- 認証済みユーザーは誰でもお知らせを作成可能
DROP POLICY IF EXISTS "Authenticated users can create announcements" ON announcements;
CREATE POLICY "Authenticated users can create announcements" ON announcements
  FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- 自分の投稿のみ編集・削除可能
DROP POLICY IF EXISTS "Users can update their own announcements" ON announcements;
CREATE POLICY "Users can update their own announcements" ON announcements
  FOR UPDATE
  USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Users can delete their own announcements" ON announcements;
CREATE POLICY "Users can delete their own announcements" ON announcements
  FOR DELETE
  USING (auth.uid() = author_id);

-- 参加者情報は全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view participants" ON announcement_participants;
CREATE POLICY "Anyone can view participants" ON announcement_participants
  FOR SELECT
  USING (true);

-- 参加登録は本人のみ可能
DROP POLICY IF EXISTS "Users can join events" ON announcement_participants;
CREATE POLICY "Users can join events" ON announcement_participants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 参加キャンセルは本人のみ可能
DROP POLICY IF EXISTS "Users can cancel their participation" ON announcement_participants;
CREATE POLICY "Users can cancel their participation" ON announcement_participants
  FOR DELETE
  USING (auth.uid() = user_id);

-- コメントは全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view comments" ON announcement_comments;
CREATE POLICY "Anyone can view comments" ON announcement_comments
  FOR SELECT
  USING (true);

-- コメント投稿は認証済みユーザーのみ
DROP POLICY IF EXISTS "Authenticated users can comment" ON announcement_comments;
CREATE POLICY "Authenticated users can comment" ON announcement_comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自分のコメントのみ削除可能
DROP POLICY IF EXISTS "Users can delete their comments" ON announcement_comments;
CREATE POLICY "Users can delete their comments" ON announcement_comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- 既読情報は本人のみ閲覧可能
DROP POLICY IF EXISTS "Users can view their own reads" ON announcement_reads;
CREATE POLICY "Users can view their own reads" ON announcement_reads
  FOR SELECT
  USING (auth.uid() = user_id);

-- 既読登録は本人のみ可能
DROP POLICY IF EXISTS "Users can mark as read" ON announcement_reads;
CREATE POLICY "Users can mark as read" ON announcement_reads
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- updated_at自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;
CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON announcements
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_announcement_comments_updated_at ON announcement_comments;
CREATE TRIGGER update_announcement_comments_updated_at
  BEFORE UPDATE ON announcement_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
