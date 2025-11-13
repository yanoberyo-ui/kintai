-- ユニット別日次粗利テーブル
CREATE TABLE IF NOT EXISTS daily_unit_revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  department VARCHAR(100) NOT NULL, -- ユニット名（部署名）
  gross_profit DECIMAL(12, 2) NOT NULL DEFAULT 0, -- 粗利
  notes TEXT, -- メモ
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- 1つのユニットに1日1レコード
  UNIQUE(date, department)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_daily_unit_revenue_date ON daily_unit_revenue(date);
CREATE INDEX IF NOT EXISTS idx_daily_unit_revenue_department ON daily_unit_revenue(department);
CREATE INDEX IF NOT EXISTS idx_daily_unit_revenue_date_dept ON daily_unit_revenue(date, department);

-- RLS (Row Level Security) 設定
ALTER TABLE daily_unit_revenue ENABLE ROW LEVEL SECURITY;

-- 管理者のみ閲覧・管理可能
DROP POLICY IF EXISTS "Admins can manage unit revenue" ON daily_unit_revenue;
CREATE POLICY "Admins can manage unit revenue" ON daily_unit_revenue
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- updated_at自動更新トリガー
DROP TRIGGER IF EXISTS update_daily_unit_revenue_updated_at ON daily_unit_revenue;
CREATE TRIGGER update_daily_unit_revenue_updated_at
  BEFORE UPDATE ON daily_unit_revenue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
