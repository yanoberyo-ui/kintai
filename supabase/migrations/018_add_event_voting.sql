-- announcementsテーブルにイベント投票用のカラムを追加
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS event_type TEXT CHECK (event_type IN ('none', 'participation', 'schedule'));
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS voting_deadline TIMESTAMPTZ;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS event_date_options TEXT[]; -- 日程候補（配列）
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_voting_closed BOOLEAN DEFAULT FALSE;

-- デフォルト値を設定
UPDATE announcements SET event_type = 'none' WHERE event_type IS NULL;

-- イベント投票テーブル（参加投票用）
CREATE TABLE IF NOT EXISTS event_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('yes', 'no', 'maybe')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1つのイベントに1ユーザー1票
  UNIQUE(announcement_id, user_id)
);

-- 日程投票テーブル（日程希望投票用）
CREATE TABLE IF NOT EXISTS schedule_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_option TEXT NOT NULL, -- 投票する日程候補
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1ユーザーが複数の日程に投票可能
  UNIQUE(announcement_id, user_id, date_option)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_announcements_event_type ON announcements(event_type);
CREATE INDEX IF NOT EXISTS idx_announcements_voting_deadline ON announcements(voting_deadline);
CREATE INDEX IF NOT EXISTS idx_event_votes_announcement ON event_votes(announcement_id);
CREATE INDEX IF NOT EXISTS idx_event_votes_user ON event_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_votes_announcement ON schedule_votes(announcement_id);
CREATE INDEX IF NOT EXISTS idx_schedule_votes_user ON schedule_votes(user_id);

-- RLS (Row Level Security) 設定
ALTER TABLE event_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_votes ENABLE ROW LEVEL SECURITY;

-- 投票は全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view event votes" ON event_votes;
CREATE POLICY "Anyone can view event votes" ON event_votes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Anyone can view schedule votes" ON schedule_votes;
CREATE POLICY "Anyone can view schedule votes" ON schedule_votes
  FOR SELECT
  USING (true);

-- 認証済みユーザーは自分の投票を作成・更新・削除可能
DROP POLICY IF EXISTS "Users can manage their event votes" ON event_votes;
CREATE POLICY "Users can manage their event votes" ON event_votes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their schedule votes" ON schedule_votes;
CREATE POLICY "Users can manage their schedule votes" ON schedule_votes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE event_votes IS 'イベント参加投票テーブル';
COMMENT ON TABLE schedule_votes IS '日程希望投票テーブル';
COMMENT ON COLUMN announcements.event_type IS 'イベントタイプ: none(通常), participation(参加投票), schedule(日程投票)';
COMMENT ON COLUMN announcements.voting_deadline IS '投票期限';
COMMENT ON COLUMN announcements.event_date_options IS '日程候補の配列';
COMMENT ON COLUMN announcements.is_voting_closed IS '投票が締め切られたかどうか';
