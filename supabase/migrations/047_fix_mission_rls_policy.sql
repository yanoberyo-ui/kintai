-- ミッション配布のRLSポリシーを修正
-- 問題: INSERT権限が管理者のみに制限されていたため、一般参加者がミッションを受け取れなかった

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "minigame_participant_missions_insert_policy" ON minigame_participant_missions;

-- 新しいポリシー: ログインユーザーは誰でもINSERT可能
CREATE POLICY "minigame_participant_missions_insert_policy" ON minigame_participant_missions
    FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
