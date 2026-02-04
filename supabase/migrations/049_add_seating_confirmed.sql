-- =====================================================
-- MG-018: 席配置プレビュー機能
-- 席配置の確定フラグ追加
-- =====================================================

-- minigame_seating テーブルにis_confirmedカラム追加
ALTER TABLE minigame_seating
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;

-- インデックス追加（確定済み席配置の高速取得用）
CREATE INDEX IF NOT EXISTS idx_minigame_seating_confirmed
ON minigame_seating(event_id, round_number, is_confirmed);

-- 既存データは全て確定済みとして扱う
UPDATE minigame_seating SET is_confirmed = true WHERE is_confirmed IS NULL;

-- 完了
SELECT 'Migration 049_add_seating_confirmed completed!' as status;
