-- 給料管理テーブル
CREATE TABLE IF NOT EXISTS salaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  base_salary DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 基本給
  overtime_hours DECIMAL(5, 2) DEFAULT 0, -- 残業時間
  overtime_pay DECIMAL(10, 2) DEFAULT 0, -- 残業代
  bonuses DECIMAL(10, 2) DEFAULT 0, -- ボーナス・手当
  deductions DECIMAL(10, 2) DEFAULT 0, -- 控除額
  total_salary DECIMAL(10, 2) NOT NULL DEFAULT 0, -- 総支給額
  notes TEXT, -- メモ
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  payment_date DATE, -- 支払日
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 1ユーザーあたり年月で一意
  UNIQUE(user_id, year, month)
);

-- 出勤日数集計ビュー（給料計算用）
CREATE OR REPLACE VIEW monthly_attendance_summary AS
SELECT 
  a.user_id,
  EXTRACT(YEAR FROM a.date) as year,
  EXTRACT(MONTH FROM a.date) as month,
  COUNT(*) as work_days,
  SUM(a.total_work_minutes) as total_work_minutes,
  ROUND(SUM(a.total_work_minutes) / 60.0, 2) as total_work_hours,
  COUNT(CASE WHEN a.status = 'absent' THEN 1 END) as absent_days
FROM attendances a
WHERE a.status != 'absent'
GROUP BY a.user_id, EXTRACT(YEAR FROM a.date), EXTRACT(MONTH FROM a.date);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_salaries_user_id ON salaries(user_id);
CREATE INDEX IF NOT EXISTS idx_salaries_year_month ON salaries(year, month);
CREATE INDEX IF NOT EXISTS idx_salaries_payment_status ON salaries(payment_status);

-- RLS (Row Level Security) 設定
ALTER TABLE salaries ENABLE ROW LEVEL SECURITY;

-- 本人は自分の給料のみ閲覧可能
DROP POLICY IF EXISTS "Users can view own salary" ON salaries;
CREATE POLICY "Users can view own salary" ON salaries
  FOR SELECT
  USING (auth.uid() = user_id);

-- 管理者は全ての給料情報を閲覧・管理可能
DROP POLICY IF EXISTS "Admins can manage all salaries" ON salaries;
CREATE POLICY "Admins can manage all salaries" ON salaries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- updated_at自動更新トリガー
DROP TRIGGER IF EXISTS update_salaries_updated_at ON salaries;
CREATE TRIGGER update_salaries_updated_at
  BEFORE UPDATE ON salaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
