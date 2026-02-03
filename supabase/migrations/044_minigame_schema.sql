-- =====================================================
-- Minigame Schema
-- ミニゲーム機能用DBスキーマ
-- Ticket: MG-001
-- =====================================================

-- ============================================================
-- 1. usersテーブル変更
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_minigame_admin BOOLEAN DEFAULT false;

-- ============================================================
-- 2. minigame_events（イベントマスター）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'finished')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minigame_events_status ON minigame_events(status);

-- ============================================================
-- 3. minigame_participants（参加者）
-- 認証不要、session_idで識別
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES minigame_events(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    checked_in_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_minigame_participants_event_id ON minigame_participants(event_id);
CREATE INDEX IF NOT EXISTS idx_minigame_participants_session_id ON minigame_participants(session_id);

-- ============================================================
-- 4. minigame_tables（テーブル/卓）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES minigame_events(id) ON DELETE CASCADE,
    table_number INT NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    UNIQUE(event_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_minigame_tables_event_id ON minigame_tables(event_id);

-- ============================================================
-- 5. minigame_seating（席配置）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_seating (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES minigame_events(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    table_id UUID NOT NULL REFERENCES minigame_tables(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES minigame_participants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_minigame_seating_event_id ON minigame_seating(event_id);
CREATE INDEX IF NOT EXISTS idx_minigame_seating_round ON minigame_seating(event_id, round_number);
CREATE INDEX IF NOT EXISTS idx_minigame_seating_table_id ON minigame_seating(table_id);
CREATE INDEX IF NOT EXISTS idx_minigame_seating_participant_id ON minigame_seating(participant_id);

-- ============================================================
-- 6. minigame_seating_history（同卓履歴 - 回避計算用）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_seating_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES minigame_events(id) ON DELETE CASCADE,
    participant_id_1 UUID NOT NULL REFERENCES minigame_participants(id) ON DELETE CASCADE,
    participant_id_2 UUID NOT NULL REFERENCES minigame_participants(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    UNIQUE(event_id, participant_id_1, participant_id_2, round_number)
);

CREATE INDEX IF NOT EXISTS idx_minigame_seating_history_event_id ON minigame_seating_history(event_id);
CREATE INDEX IF NOT EXISTS idx_minigame_seating_history_participants ON minigame_seating_history(participant_id_1, participant_id_2);

-- ============================================================
-- 7. minigame_timer（タイマー状態）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_timer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES minigame_events(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ,
    duration_seconds INT NOT NULL DEFAULT 180,
    is_running BOOLEAN NOT NULL DEFAULT false,
    UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_minigame_timer_event_id ON minigame_timer(event_id);

-- ============================================================
-- 8. minigame_missions（ミッションマスター）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minigame_missions_difficulty ON minigame_missions(difficulty);

-- ============================================================
-- 9. minigame_participant_missions（ミッション配布）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_participant_missions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES minigame_events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES minigame_participants(id) ON DELETE CASCADE,
    mission_id UUID NOT NULL REFERENCES minigame_missions(id) ON DELETE CASCADE,
    completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minigame_participant_missions_event_id ON minigame_participant_missions(event_id);
CREATE INDEX IF NOT EXISTS idx_minigame_participant_missions_participant_id ON minigame_participant_missions(participant_id);

-- ============================================================
-- 10. minigame_topics（お題カードマスター）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minigame_topics_category ON minigame_topics(category);

-- ============================================================
-- 11. minigame_topic_draws（お題引いた履歴）
-- ============================================================

CREATE TABLE IF NOT EXISTS minigame_topic_draws (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES minigame_events(id) ON DELETE CASCADE,
    table_id UUID NOT NULL REFERENCES minigame_tables(id) ON DELETE CASCADE,
    round_number INT NOT NULL,
    topic_id UUID NOT NULL REFERENCES minigame_topics(id) ON DELETE CASCADE,
    drawn_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minigame_topic_draws_event_id ON minigame_topic_draws(event_id);
CREATE INDEX IF NOT EXISTS idx_minigame_topic_draws_table_round ON minigame_topic_draws(table_id, round_number);

-- ============================================================
-- 12. 自動更新トリガー（updated_at）
-- ============================================================

CREATE TRIGGER update_minigame_events_updated_at BEFORE UPDATE ON minigame_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 13. Row Level Security (RLS) ポリシー
-- ============================================================

-- minigame_events: 全員読み取り可能、管理者のみ編集
ALTER TABLE minigame_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_events_select_policy" ON minigame_events
    FOR SELECT USING (true);

CREATE POLICY "minigame_events_insert_policy" ON minigame_events
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_events_update_policy" ON minigame_events
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_events_delete_policy" ON minigame_events
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_participants: 認証不要でアクセス可能
ALTER TABLE minigame_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_participants_select_policy" ON minigame_participants
    FOR SELECT USING (true);

CREATE POLICY "minigame_participants_insert_policy" ON minigame_participants
    FOR INSERT WITH CHECK (true);

CREATE POLICY "minigame_participants_update_policy" ON minigame_participants
    FOR UPDATE USING (true);

CREATE POLICY "minigame_participants_delete_policy" ON minigame_participants
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_tables: 全員読み取り可能、管理者のみ編集
ALTER TABLE minigame_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_tables_select_policy" ON minigame_tables
    FOR SELECT USING (true);

CREATE POLICY "minigame_tables_insert_policy" ON minigame_tables
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_tables_update_policy" ON minigame_tables
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_tables_delete_policy" ON minigame_tables
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_seating: 全員読み取り可能、管理者のみ編集
ALTER TABLE minigame_seating ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_seating_select_policy" ON minigame_seating
    FOR SELECT USING (true);

CREATE POLICY "minigame_seating_insert_policy" ON minigame_seating
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_seating_update_policy" ON minigame_seating
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_seating_delete_policy" ON minigame_seating
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_seating_history: 全員読み取り可能、管理者のみ編集
ALTER TABLE minigame_seating_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_seating_history_select_policy" ON minigame_seating_history
    FOR SELECT USING (true);

CREATE POLICY "minigame_seating_history_insert_policy" ON minigame_seating_history
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_timer: 全員読み取り可能、管理者のみ編集
ALTER TABLE minigame_timer ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_timer_select_policy" ON minigame_timer
    FOR SELECT USING (true);

CREATE POLICY "minigame_timer_insert_policy" ON minigame_timer
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_timer_update_policy" ON minigame_timer
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_missions: 全員読み取り可能、管理者のみ編集
ALTER TABLE minigame_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_missions_select_policy" ON minigame_missions
    FOR SELECT USING (true);

CREATE POLICY "minigame_missions_insert_policy" ON minigame_missions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_participant_missions: 全員読み取り/更新可能、管理者のみ作成
ALTER TABLE minigame_participant_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_participant_missions_select_policy" ON minigame_participant_missions
    FOR SELECT USING (true);

CREATE POLICY "minigame_participant_missions_insert_policy" ON minigame_participant_missions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

CREATE POLICY "minigame_participant_missions_update_policy" ON minigame_participant_missions
    FOR UPDATE USING (true);

-- minigame_topics: 全員読み取り可能、管理者のみ編集
ALTER TABLE minigame_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_topics_select_policy" ON minigame_topics
    FOR SELECT USING (true);

CREATE POLICY "minigame_topics_insert_policy" ON minigame_topics
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_minigame_admin = true)
    );

-- minigame_topic_draws: 全員読み取り/挿入可能
ALTER TABLE minigame_topic_draws ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minigame_topic_draws_select_policy" ON minigame_topic_draws
    FOR SELECT USING (true);

CREATE POLICY "minigame_topic_draws_insert_policy" ON minigame_topic_draws
    FOR INSERT WITH CHECK (true);

-- ============================================================
-- 14. Realtime有効化
-- ============================================================

-- Supabase Realtime用のpublication設定
-- 注意: supabase_realtimeはSupabaseが自動作成するpublication

ALTER PUBLICATION supabase_realtime ADD TABLE minigame_timer;
ALTER PUBLICATION supabase_realtime ADD TABLE minigame_seating;
ALTER PUBLICATION supabase_realtime ADD TABLE minigame_participants;

-- ============================================================
-- 完了メッセージ
-- ============================================================

SELECT 'Minigame schema created successfully!' as status;
