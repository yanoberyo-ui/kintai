-- =====================================================
-- ミッション追加
-- =====================================================

INSERT INTO minigame_missions (content, difficulty) VALUES
  ('{name}さんと3秒間目を合わせよう', 'easy'),
  ('{name}さんを褒めよう', 'easy'),
  ('{name}さんに質問を3つしよう', 'medium'),
  ('{name}さんと笑い合おう', 'easy')
ON CONFLICT DO NOTHING;

SELECT 'Migration 050_add_more_missions completed!' as status;
