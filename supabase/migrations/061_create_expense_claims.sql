CREATE TABLE expense_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(200) NOT NULL,
  description TEXT,
  amount DECIMAL(10,2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  expense_date DATE NOT NULL,
  receipt_urls TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending',
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expense_claims_user ON expense_claims(user_id);
CREATE INDEX idx_expense_claims_status ON expense_claims(status);

ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expenses" ON expense_claims
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all expenses" ON expense_claims
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at
CREATE TRIGGER update_expense_claims_updated_at
  BEFORE UPDATE ON expense_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
