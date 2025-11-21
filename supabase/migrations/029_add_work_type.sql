-- 勤務タイプ（リモート/出社）を追加
-- 作成日: 2025-01-XX

-- attendancesテーブルにwork_typeカラムを追加
ALTER TABLE attendances
ADD COLUMN IF NOT EXISTS work_type VARCHAR(20) CHECK (work_type IN ('remote', 'office', NULL));

-- インデックスを追加（交通費計算などで使用）
CREATE INDEX IF NOT EXISTS idx_attendances_work_type ON attendances(work_type);

-- コメントを追加
COMMENT ON COLUMN attendances.work_type IS '勤務タイプ: remote=リモート, office=出社';

