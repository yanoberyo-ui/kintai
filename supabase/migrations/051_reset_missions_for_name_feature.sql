-- =====================================================
-- MG-016: パーソナライズドミッション修正
-- {name}を含むミッションでtargetがないものをリセット
-- =====================================================

-- {name}を含むミッションでtarget_participant_idがnullのものを削除
DELETE FROM minigame_participant_missions 
WHERE target_participant_id IS NULL
  AND mission_id IN (
    SELECT id FROM minigame_missions WHERE content LIKE '%{name}%'
  );

SELECT 'Migration 051: Missions with {name} but no target cleared!' as status;
