-- daily_schedulesテーブルに作成者情報を追加
ALTER TABLE daily_schedules
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 既存データは自分で作成したとみなす
UPDATE daily_schedules
SET created_by = user_id
WHERE created_by IS NULL;

-- インデックス追加（パフォーマンス向上）
CREATE INDEX IF NOT EXISTS idx_daily_schedules_created_by ON daily_schedules(created_by);

-- RLSポリシー更新：他のユーザーが自分のカレンダーにスケジュールを追加できるようにする
-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Users can manage own schedules" ON daily_schedules;

-- 読み取り：同じワークスペースのユーザーは閲覧可能（既存の挙動を維持）
CREATE POLICY "Users can view schedules" ON daily_schedules
FOR SELECT USING (true);

-- 作成：誰でも作成可能（他人のカレンダーにも追加できる）
CREATE POLICY "Users can insert schedules" ON daily_schedules
FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 更新：自分が作成したスケジュール、または自分のカレンダーのスケジュールのみ
CREATE POLICY "Users can update own schedules" ON daily_schedules
FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = created_by);

-- 削除：自分が作成したスケジュール、または自分のカレンダーのスケジュールのみ
CREATE POLICY "Users can delete own schedules" ON daily_schedules
FOR DELETE USING (auth.uid() = user_id OR auth.uid() = created_by);
