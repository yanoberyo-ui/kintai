-- =====================================================
-- 全ミッション配布をクリア（再配布用）
-- =====================================================

DELETE FROM minigame_participant_missions;

SELECT 'Migration 052: All mission assignments cleared for fresh start!' as status;
