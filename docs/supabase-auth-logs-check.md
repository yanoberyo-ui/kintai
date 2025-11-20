# Supabase Auth Logsの確認方法

## エラーメッセージの意味

「Failed to send password recovery: Error sending recovery email」は、Supabase側でメール送信が失敗していることを示しています。

## Auth Logsの確認方法

### ステップ1: Supabaseダッシュボードでログを確認

1. **Supabaseダッシュボードにログイン**
   - https://supabase.com/dashboard にアクセス

2. **プロジェクトを選択**
   - `thwfendgywwxbdjofbdt` プロジェクトを選択

3. **Logsを開く**
   - 左メニューから「**Logs**」をクリック
   - 「**Auth Logs**」を選択

4. **エラーログを確認**
   - 最近のエラーログを確認
   - 「Error sending recovery email」に関連するログを探す
   - エラーの詳細を確認

### ステップ2: エラーログの内容を確認

Auth Logsには、以下のような情報が表示されます：

- **エラーメッセージ**: 具体的なエラー内容
- **タイムスタンプ**: エラーが発生した時刻
- **リクエスト詳細**: リクエストの詳細情報

## よくあるエラーと解決策

### エラー1: "SMTP connection failed"

**意味**: SMTPサーバーに接続できない

**原因**:
- Hostが間違っている
- Portが間違っている
- ファイアウォールでブロックされている

**解決策**:
1. Hostが `smtp.gmail.com` になっているか確認
2. Portが `587` になっているか確認
3. ネットワーク設定を確認

### エラー2: "SMTP authentication failed"

**意味**: SMTP認証に失敗した

**原因**:
- Usernameが間違っている
- Passwordが間違っている
- アプリパスワードが無効になっている

**解決策**:
1. Usernameが `yamamotoikki@forestdali.biz` になっているか確認
2. Passwordがアプリパスワードになっているか確認（スペースなし）
3. アプリパスワードを再生成して設定を更新

### エラー3: "Sender email mismatch"

**意味**: 送信者メールアドレスがSMTP設定と一致しない

**原因**:
- Sender emailとSMTP Usernameが一致していない

**解決策**:
1. Sender emailが `yamamotoikki@forestdali.biz` になっているか確認
2. SMTP Usernameも `yamamotoikki@forestdali.biz` になっているか確認
3. 両方が一致していることを確認

### エラー4: "Rate limit exceeded"

**意味**: メール送信の制限に達した

**原因**:
- 短時間に大量のメール送信を試みた

**解決策**:
1. しばらく待ってから再度試す
2. Minimum interval per userを増やす（例: 60秒 → 120秒）

## 詳細なトラブルシューティング手順

### 1. SMTP設定の再確認

Supabaseダッシュボードで設定を確認：

```
Host: smtp.gmail.com
Port: 587
Username: yamamotoikki@forestdali.biz
Password: 【アプリパスワード】（スペースなし、16文字）
Minimum interval per user: 60

Sender email: yamamotoikki@forestdali.biz
Sender name: FD Hub
```

### 2. アプリパスワードの再生成

1. **Googleアカウント設定を開く**
   - https://myaccount.google.com/security にアクセス

2. **アプリパスワードを確認**
   - 「アプリパスワード」をクリック
   - 既存のパスワードを削除（必要に応じて）

3. **新しいアプリパスワードを生成**
   - 「アプリを選択」→「メール」を選択
   - 「デバイスを選択」→「その他（カスタム名）」を選択
   - 名前を入力（例: `Supabase SMTP`）
   - 「生成」をクリック
   - **16文字のパスワードをコピー**（スペースなし）

4. **Supabaseの設定を更新**
   - Passwordフィールドに新しいアプリパスワードを入力
   - 「Save」をクリック

### 3. Google Workspaceの設定確認

Google Workspace管理者の場合：

1. **Google Workspace管理コンソールにアクセス**
   - https://admin.google.com にアクセス

2. **セキュリティ設定を確認**
   - 「セキュリティ」→「API制御」を開く
   - 「アプリパスワード」が有効になっているか確認

3. **ユーザーの2段階認証を確認**
   - ユーザーアカウントで2段階認証が有効になっているか確認

### 4. テストメールの再送信

1. **Supabaseダッシュボードでテスト**
   - 「Authentication」→「Email Templates」→「Reset Password」
   - 「Send test email」をクリック
   - メールアドレスを入力して送信

2. **エラーログを確認**
   - 「Logs」→「Auth Logs」でエラーの詳細を確認

### 5. 別のメールアドレスでテスト

1. **別のメールアドレスでテスト**
   - 同じGoogle Workspaceアカウントの別のメールアドレスでテスト
   - または、個人のGmailアドレスでテスト

2. **結果を確認**
   - 別のメールアドレスで成功する場合、特定のアカウントに問題がある可能性

## チェックリスト

- [ ] SupabaseダッシュボードでAuth Logsを確認
- [ ] エラーメッセージの詳細を確認
- [ ] SMTP設定が正しいか確認
- [ ] アプリパスワードが正しいか確認（スペースなし）
- [ ] Sender emailとSMTP Usernameが一致しているか確認
- [ ] 2段階認証が有効になっているか確認
- [ ] Google Workspaceのアプリパスワードが有効になっているか確認
- [ ] 新しいアプリパスワードを生成して設定を更新
- [ ] テストメールを再送信して確認

## 次のステップ

1. **Auth Logsを確認**
   - エラーの詳細を確認
   - エラーメッセージに基づいて対処

2. **SMTP設定を再確認**
   - すべての設定が正しいか確認
   - 必要に応じて設定を更新

3. **アプリパスワードを再生成**
   - 新しいアプリパスワードを生成
   - Supabaseの設定を更新

4. **テストメールを再送信**
   - エラーが解消されたか確認

## まとめ

「Error sending recovery email」エラーは、通常、SMTP設定の問題が原因です。

確認すべきポイント：
1. **Auth Logsでエラーの詳細を確認**
2. **SMTP設定が正しいか確認**
3. **アプリパスワードが正しいか確認**
4. **送信者メールアドレスとSMTP設定が一致しているか確認**

Auth Logsのエラーメッセージを共有していただければ、より具体的な解決策を提案できます。

