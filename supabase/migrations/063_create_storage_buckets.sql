-- 経費申請の領収書用バケット
INSERT INTO storage.buckets (id, name, public)
VALUES ('expense-receipts', 'expense-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- 契約書PDF用バケット
INSERT INTO storage.buckets (id, name, public)
VALUES ('contracts', 'contracts', false)
ON CONFLICT (id) DO NOTHING;

-- expense-receipts: ユーザーは自分のフォルダのみアップロード/閲覧可能
CREATE POLICY "Users can upload own receipts" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'expense-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view own receipts" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'expense-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all receipts" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'expense-receipts'
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- contracts: 管理者はアップロード可能、署名者は自分宛の契約PDFを閲覧可能
CREATE POLICY "Admins can upload contract PDFs" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'contracts'
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can view all contract PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'contracts'
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Signers can view own contract PDFs" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'contracts'
    AND EXISTS (
      SELECT 1 FROM contracts
      WHERE pdf_url LIKE '%' || storage.objects.name || '%'
      AND signer_id = auth.uid()
    )
  );
