-- 通知の非表示状態を管理するテーブル
-- 作成日: 2025-01-XX

CREATE TABLE IF NOT EXISTS notification_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('event', 'today', 'followup', 'request')),
  notification_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT NOW(),

  -- 1ユーザーが同じ通知を複数回非表示にしないように
  UNIQUE(user_id, notification_type, notification_id)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user_id ON notification_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_dismissals_type_id ON notification_dismissals(notification_type, notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_dismissals_user_type ON notification_dismissals(user_id, notification_type);

-- RLSポリシー
ALTER TABLE notification_dismissals ENABLE ROW LEVEL SECURITY;

-- ユーザーは自分の非表示状態のみ閲覧可能
CREATE POLICY "Users can view their own notification dismissals"
  ON notification_dismissals
  FOR SELECT
  USING (auth.uid() = user_id);

-- ユーザーは自分の非表示状態のみ作成可能
CREATE POLICY "Users can insert their own notification dismissals"
  ON notification_dismissals
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- コメント
COMMENT ON TABLE notification_dismissals IS 'ユーザーが閉じた通知の記録';
COMMENT ON COLUMN notification_dismissals.notification_type IS '通知タイプ: event=イベント投票, today=当日イベント, followup=フォローアップメッセージ, request=お願いもの';
COMMENT ON COLUMN notification_dismissals.notification_id IS '通知のID（announcement_id または event_follow_up_message_id）';

