-- フォローアップメッセージテーブル
CREATE TABLE IF NOT EXISTS event_follow_up_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('all_participants', 'date_option_voters')),
  date_option_id UUID REFERENCES event_date_options(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- date_option_votersの場合はdate_option_idが必須
  CHECK (
    (target_type = 'all_participants' AND date_option_id IS NULL) OR
    (target_type = 'date_option_voters' AND date_option_id IS NOT NULL)
  )
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_follow_up_messages_announcement ON event_follow_up_messages(announcement_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_messages_author ON event_follow_up_messages(author_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_messages_created_at ON event_follow_up_messages(created_at);

-- RLS (Row Level Security) 設定
ALTER TABLE event_follow_up_messages ENABLE ROW LEVEL SECURITY;

-- 全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view follow up messages" ON event_follow_up_messages;
CREATE POLICY "Anyone can view follow up messages" ON event_follow_up_messages
  FOR SELECT
  USING (true);

-- イベント投稿者のみが自分のイベントに対してメッセージを作成可能
DROP POLICY IF EXISTS "Event authors can create follow up messages" ON event_follow_up_messages;
CREATE POLICY "Event authors can create follow up messages" ON event_follow_up_messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM announcements
      WHERE announcements.id = announcement_id
      AND announcements.author_id = auth.uid()
    )
  );

-- 投稿者は自分のメッセージを削除可能
DROP POLICY IF EXISTS "Authors can delete their follow up messages" ON event_follow_up_messages;
CREATE POLICY "Authors can delete their follow up messages" ON event_follow_up_messages
  FOR DELETE
  USING (auth.uid() = author_id);

COMMENT ON TABLE event_follow_up_messages IS 'イベント参加者へのフォローアップメッセージ';
COMMENT ON COLUMN event_follow_up_messages.target_type IS 'ターゲット: all_participants(全参加者), date_option_voters(特定日程投票者)';
COMMENT ON COLUMN event_follow_up_messages.date_option_id IS '特定日程投票者向けの場合の日程オプションID';
