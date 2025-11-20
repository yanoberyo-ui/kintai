# 500エラー「Error sending recovery email」の解決方法

## エラーの意味

500エラーは、Supabase側でメール送信処理が失敗していることを示しています。これは通常、SMTP設定に問題がある場合に発生します。

## 確認すべきポイント

### 1. SMTP設定が正しく保存されているか

1. Supabaseダッシュボード → 「Authentication」→「Settings」→「SMTP Settings」
2. 設定を確認：
   - Host: `smtp.gmail.com` ✅
   - Port: `587` ✅
   - Username: `yamamotoikki@forestdali.biz`
   - Password: `kfplzymbpqzvtpx`（スペースなし）
3. 「Save」をクリックして保存を確認

### 2. 送信者メールアドレスとSMTP設定の整合性

**重要な問題**: 送信者メールアドレスが `yamamotoikki@forestdali.biz` ですが、これはGmailアドレスではありません。

Gmail SMTPを使用する場合、以下の2つの選択肢があります：

#### 選択肢A: Gmailアドレスを使用する（推奨）

1. Gmailアカウントを用意（例: `your-email@gmail.com`）
2. そのGmailアカウントでアプリパスワードを生成
3. Supabaseの設定を更新：

```
Sender email: your-email@gmail.com
SMTP Username: your-email@gmail.com
SMTP Password: 【Gmailアプリパスワード】
```

#### 選択肢B: forestdali.bizドメイン用のSMTPを使用する

`yamamotoikki@forestdali.biz` を使用する場合、Gmail SMTPではなく、このドメイン用のSMTP設定が必要です。

1. メールホスティングプロバイダー（例: Google Workspace、Microsoft 365、独自サーバー）のSMTP設定を確認
2. そのSMTP設定をSupabaseに入力

### 3. Gmailアプリパスワードの確認

現在のアプリパスワード `kfplzymbpqzvtpx` が正しいか確認：

1. Googleアカウント設定 → セキュリティ
2. 「アプリパスワード」を確認
3. 「Supabase SMTP」などの名前でパスワードが生成されているか確認
4. 必要に応じて、新しいアプリパスワードを生成

### 4. Supabaseダッシュボードでテストメールを送信

1. 「Authentication」→「Email Templates」→「Reset Password」
2. 「Send test email」ボタンをクリック
3. メールアドレスを入力して送信
4. エラーメッセージが表示されるか確認

### 5. エラーログの確認

1. Supabaseダッシュボード → 「Authentication」→「Users」
2. テストメールを送信したユーザーを検索
3. メール送信履歴を確認
4. エラーメッセージの詳細を確認

## よくある問題と解決策

### 問題1: 送信者メールアドレスとSMTP設定が一致していない

**症状**: Gmail SMTPを使用しているが、送信者メールアドレスがGmailではない

**解決策**: 
- Gmailアドレスを使用する、または
- 送信者メールアドレス用のSMTP設定を使用する

### 問題2: アプリパスワードが無効

**症状**: アプリパスワードが削除された、または無効になっている

**解決策**: 
- 新しいアプリパスワードを生成
- Supabaseの設定を更新

### 問題3: 2段階認証が無効

**症状**: 2段階認証が無効になっているため、アプリパスワードが機能しない

**解決策**: 
- 2段階認証を有効化
- アプリパスワードを再生成

### 問題4: SMTP設定が保存されていない

**症状**: 設定を変更したが、保存されていない

**解決策**: 
- 「Save」ボタンをクリック
- ページをリロードして設定を確認

## 推奨される設定（Gmailを使用する場合）

```
Sender details:
- Sender email: your-email@gmail.com  ← Gmailアドレス
- Sender name: FD Hub

SMTP provider settings:
- Host: smtp.gmail.com
- Port: 587
- Username: your-email@gmail.com  ← Gmailアドレス
- Password: 【Gmailアプリパスワード】（16文字、スペースなし）
- Minimum interval per user: 60
```

## 推奨される設定（forestdali.bizドメインを使用する場合）

メールホスティングプロバイダーのSMTP設定を確認して使用：

```
Sender details:
- Sender email: yamamotoikki@forestdali.biz
- Sender name: FD Hub

SMTP provider settings:
- Host: 【メールホスティングプロバイダーのSMTPサーバー】
- Port: 587（またはプロバイダーが指定するポート）
- Username: yamamotoikki@forestdali.biz
- Password: 【メールアカウントのパスワードまたはアプリパスワード】
- Minimum interval per user: 60
```

## 次のステップ

1. **送信者メールアドレスとSMTP設定の整合性を確認**
   - Gmail SMTPを使用する場合は、Gmailアドレスを使用
   - forestdali.bizドメインを使用する場合は、そのドメイン用のSMTP設定を使用

2. **Supabaseダッシュボードでテストメールを送信**
   - エラーメッセージの詳細を確認

3. **エラーログを確認**
   - より詳細なエラー情報を取得

4. **必要に応じて新しいアプリパスワードを生成**
   - 設定を更新して再テスト

## まとめ

500エラー「Error sending recovery email」は、通常、SMTP設定の問題が原因です。特に：

1. **送信者メールアドレスとSMTP設定が一致していない**
2. **アプリパスワードが無効または間違っている**
3. **SMTP設定が正しく保存されていない**

上記を確認して修正してください。

