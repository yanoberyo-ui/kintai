CREATE TABLE contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT,
  pdf_url TEXT,
  template_id UUID REFERENCES contract_templates(id),
  created_by UUID NOT NULL REFERENCES users(id),
  signer_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'draft',
  sign_token VARCHAR(100) UNIQUE,
  sign_token_expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  signer_ip INET,
  signer_user_agent TEXT,
  rejected_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contracts_signer ON contracts(signer_id);
CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_sign_token ON contracts(sign_token);
CREATE INDEX idx_contracts_created_by ON contracts(created_by);

ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

-- Template policies
CREATE POLICY "Admins can manage templates" ON contract_templates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Users can view templates" ON contract_templates
  FOR SELECT USING (true);

-- Contract policies
CREATE POLICY "Admins can manage all contracts" ON contracts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Signers can view own contracts" ON contracts
  FOR SELECT USING (auth.uid() = signer_id);

CREATE POLICY "Signers can update own contracts" ON contracts
  FOR UPDATE USING (auth.uid() = signer_id)
  WITH CHECK (auth.uid() = signer_id);

-- Auto-update triggers
CREATE TRIGGER update_contract_templates_updated_at
  BEFORE UPDATE ON contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
