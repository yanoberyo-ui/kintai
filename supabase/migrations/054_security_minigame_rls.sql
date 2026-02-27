-- =====================================================
-- セキュリティ修正: ミニゲーム参加者RLSポリシー
-- 認証なしのINSERT/UPDATEを認証必須に変更
-- =====================================================

-- 既存のオープンなポリシーを削除
DROP POLICY IF EXISTS "minigame_participants_insert_policy" ON minigame_participants;
DROP POLICY IF EXISTS "minigame_participants_update_policy" ON minigame_participants;

-- 認証必須のINSERTポリシー
CREATE POLICY "minigame_participants_insert_authenticated"
    ON minigame_participants
    FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- 認証必須のUPDATEポリシー
CREATE POLICY "minigame_participants_update_authenticated"
    ON minigame_participants
    FOR UPDATE
    USING (auth.uid() IS NOT NULL);
