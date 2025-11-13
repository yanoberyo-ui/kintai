-- イベント日程候補テーブル
CREATE TABLE IF NOT EXISTS event_date_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  option_date TIMESTAMPTZ NOT NULL,
  option_label TEXT, -- 例: "午前の部", "午後の部" など
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- イベント日程投票テーブル
CREATE TABLE IF NOT EXISTS event_date_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_option_id UUID NOT NULL REFERENCES event_date_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 1つの日程候補に1ユーザー1回のみ投票
  UNIQUE(date_option_id, user_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_event_date_options_announcement ON event_date_options(announcement_id);
CREATE INDEX IF NOT EXISTS idx_event_date_votes_option ON event_date_votes(date_option_id);
CREATE INDEX IF NOT EXISTS idx_event_date_votes_user ON event_date_votes(user_id);

-- RLS (Row Level Security) 設定
ALTER TABLE event_date_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_date_votes ENABLE ROW LEVEL SECURITY;

-- 日程候補は全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view date options" ON event_date_options;
CREATE POLICY "Anyone can view date options" ON event_date_options
  FOR SELECT
  USING (true);

-- 認証済みユーザーは日程候補を作成可能（投稿者のみに制限したい場合は別途修正）
DROP POLICY IF EXISTS "Authenticated users can create date options" ON event_date_options;
CREATE POLICY "Authenticated users can create date options" ON event_date_options
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- 日程候補の削除は投稿者のみ（announcementの作成者）
DROP POLICY IF EXISTS "Announcement authors can delete date options" ON event_date_options;
CREATE POLICY "Announcement authors can delete date options" ON event_date_options
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM announcements 
      WHERE announcements.id = event_date_options.announcement_id 
      AND announcements.author_id = auth.uid()
    )
  );

-- 投票は全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view votes" ON event_date_votes;
CREATE POLICY "Anyone can view votes" ON event_date_votes
  FOR SELECT
  USING (true);

-- 投票は本人のみ可能
DROP POLICY IF EXISTS "Users can vote" ON event_date_votes;
CREATE POLICY "Users can vote" ON event_date_votes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 投票取り消しは本人のみ可能
DROP POLICY IF EXISTS "Users can unvote" ON event_date_votes;
CREATE POLICY "Users can unvote" ON event_date_votes
  FOR DELETE
  USING (auth.uid() = user_id);
