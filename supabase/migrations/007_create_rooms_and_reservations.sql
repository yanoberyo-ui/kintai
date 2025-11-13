-- 会議室テーブル
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  capacity INTEGER,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会議室予約テーブル
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  -- 繰り返し予約用
  is_recurring BOOLEAN DEFAULT FALSE,
  recurrence_rule TEXT, -- 'weekly', 'daily', 'monthly'など
  recurrence_end_date DATE,
  parent_reservation_id UUID REFERENCES reservations(id) ON DELETE CASCADE, -- 繰り返し予約の親
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- 制約: 終了時刻は開始時刻より後
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_reservations_room_time ON reservations(room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_parent ON reservations(parent_reservation_id);

-- RLS (Row Level Security) 設定
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

-- 会議室は全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view rooms" ON rooms;
CREATE POLICY "Anyone can view rooms" ON rooms
  FOR SELECT
  USING (true);

-- 管理者のみ会議室を作成・編集
DROP POLICY IF EXISTS "Admins can manage rooms" ON rooms;
CREATE POLICY "Admins can manage rooms" ON rooms
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- 予約は全員が閲覧可能
DROP POLICY IF EXISTS "Anyone can view reservations" ON reservations;
CREATE POLICY "Anyone can view reservations" ON reservations
  FOR SELECT
  USING (true);

-- ユーザーは自分の予約を作成可能
DROP POLICY IF EXISTS "Users can create reservations" ON reservations;
CREATE POLICY "Users can create reservations" ON reservations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ユーザーは自分の予約を編集・削除可能
DROP POLICY IF EXISTS "Users can update own reservations" ON reservations;
CREATE POLICY "Users can update own reservations" ON reservations
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own reservations" ON reservations;
CREATE POLICY "Users can delete own reservations" ON reservations
  FOR DELETE
  USING (auth.uid() = user_id);

-- 初期データ: デフォルト会議室を作成
INSERT INTO rooms (name, description, capacity, color)
VALUES ('会議室', 'メイン会議室', 10, '#3B82F6')
ON CONFLICT DO NOTHING;

-- 更新日時の自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rooms_updated_at ON rooms;
CREATE TRIGGER update_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reservations_updated_at ON reservations;
CREATE TRIGGER update_reservations_updated_at
  BEFORE UPDATE ON reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
