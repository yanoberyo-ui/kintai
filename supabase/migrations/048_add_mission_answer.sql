-- =====================================================
-- MG-016: ミッション回答機能
-- パーソナライズドミッション対応
-- =====================================================

-- 1. minigame_participant_missions テーブルにカラム追加
ALTER TABLE minigame_participant_missions
ADD COLUMN IF NOT EXISTS answer TEXT,
ADD COLUMN IF NOT EXISTS target_participant_id UUID REFERENCES minigame_participants(id) ON DELETE SET NULL;

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_minigame_participant_missions_target
ON minigame_participant_missions(target_participant_id);

-- 2. {name}プレースホルダー付きミッションを追加
INSERT INTO minigame_missions (content, difficulty) VALUES
  ('{name}さんとの共通点を1つ見つけよう', 'medium'),
  ('{name}さんの良いところを1つ伝えよう', 'medium'),
  ('{name}さんの趣味について聞いてみよう', 'easy'),
  ('{name}さんに最近ハマっていることを聞こう', 'easy'),
  ('{name}さんと今度一緒にやりたいことを決めよう', 'medium'),
  ('{name}さんの意外な一面を発見しよう', 'hard')
ON CONFLICT DO NOTHING;

-- 完了
SELECT 'Migration 048_add_mission_answer completed!' as status;
