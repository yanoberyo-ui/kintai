# Supabase SMTP設定ガイド

## 画面の説明

この画面は、SupabaseでカスタムSMTPサーバーを設定するためのフォームです。各項目の設定方法を説明します。

## 各フィールドの説明

### 1. Host（必須）
**説明**: SMTPサーバーのホスト名またはIPアドレス

**設定例：**
- Gmail: `smtp.gmail.com`
- SendGrid: `smtp.sendgrid.net`
- Mailgun: `smtp.mailgun.org`
- Outlook: `smtp-mail.outlook.com`

### 2. Port number
**説明**: SMTPサーバーが使用するポート番号

**設定例：**
- **587**（推奨）: TLS/STARTTLS用のポート（ほとんどのSMTPサーバーで推奨）
- **465**: SSL/TLS用のポート（Gmailなどで使用）
- **25**: 通常はブロックされているため避ける

**注意**: ポート587を使用する場合は、後述の「Use TLS」オプションを有効にする必要があります。

### 3. Minimum interval per user
**説明**: 同じユーザーにメールを送信する間隔の最小値（秒）

**推奨値：**
- **60秒**: デフォルト値（推奨）
- スパム防止のため、短くしすぎないように注意

### 4. Username（必須）
**説明**: SMTPサーバーへの認証に使用するユーザー名

**設定例：**
- Gmail: あなたのGmailアドレス（例: `your-email@gmail.com`）
- SendGrid: `apikey`（固定値）
- Mailgun: Mailgunから提供されるSMTPユーザー名

### 5. Password（必須）
**説明**: SMTPサーバーへの認証に使用するパスワード

**設定例：**
- Gmail: **アプリパスワード**（通常のパスワードではない）
- SendGrid: SendGridのAPI Key
- Mailgun: Mailgunから提供されるSMTPパスワード

## 具体的な設定例

### Gmailの設定

1. **Googleアカウントの準備**
   - 2段階認証を有効化
   - アプリパスワードを生成（16文字）

2. **Supabaseでの設定**
   ```
   Host: smtp.gmail.com
   Port number: 587
   Username: your-email@gmail.com
   Password: 【16文字のアプリパスワード】
   Minimum interval per user: 60
   ```

3. **Gmailアプリパスワードの取得方法**
   - Googleアカウント設定 → セキュリティ
   - 「2段階認証プロセス」を有効化
   - 「アプリパスワード」をクリック
   - 「メール」と「その他（カスタム名）」を選択
   - 生成された16文字のパスワードをコピー

### SendGridの設定（推奨）

1. **SendGridアカウントの準備**
   - https://sendgrid.com でアカウント作成
   - API Keyを生成（Settings → API Keys）

2. **Supabaseでの設定**
   ```
   Host: smtp.sendgrid.net
   Port number: 587
   Username: apikey
   Password: 【SendGrid API Key】
   Minimum interval per user: 60
   ```

**SendGridのメリット：**
- 無料プランで1日100通まで送信可能
- メールの到達率が高い
- 簡単に設定できる

### Mailgunの設定

1. **Mailgunアカウントの準備**
   - https://www.mailgun.com でアカウント作成
   - SMTP認証情報を取得（Sending → SMTP credentials）

2. **Supabaseでの設定**
   ```
   Host: smtp.mailgun.org
   Port number: 587
   Username: 【Mailgun SMTP Username】
   Password: 【Mailgun SMTP Password】
   Minimum interval per user: 60
   ```

**Mailgunのメリット：**
- 無料プランで1ヶ月5,000通まで送信可能
- 開発者向けの機能が充実

## 設定後の確認事項

### 1. 設定を保存
- フォームの下部にある「Save」ボタンをクリック
- エラーメッセージがないか確認

### 2. テストメールの送信
1. 「**Authentication**」→「**Email Templates**」を開く
2. 「**Reset Password**」テンプレートを選択
3. 「**Send test email**」ボタンをクリック
4. メールアドレスを入力して送信
5. メールが届くか確認

### 3. エラーが発生した場合

#### "Must be a valid URL or IP address" エラー
- Hostフィールドに正しいホスト名を入力しているか確認
- 例: `smtp.gmail.com`（`https://`は不要）

#### "SMTP Username is required" エラー
- Usernameフィールドに値を入力しているか確認
- スペースや特殊文字がないか確認

#### メールが届かない場合
- パスワードが正しいか確認（特にGmailの場合はアプリパスワードを使用）
- ポート番号が正しいか確認（587または465）
- ファイアウォールやセキュリティ設定でブロックされていないか確認

## セキュリティに関する注意

- **パスワードは暗号化されて保存されます**（画面の説明文の通り）
- 一度保存すると、パスワードは表示されません
- パスワードを変更する場合は、新しいパスワードを再度入力する必要があります

## 推奨設定

**初心者向け**: SendGrid（設定が簡単）
**Gmailユーザー**: Gmail SMTP（既存のアカウントで利用可能）
**大量送信**: Mailgun（無料枠が大きい）

## 次のステップ

1. 上記のいずれかのSMTPプロバイダーを選択
2. アカウントを作成（必要に応じて）
3. 認証情報を取得
4. SupabaseのSMTP設定フォームに入力
5. テストメールを送信して確認

設定が完了したら、パスワードリセット機能を再度試してください！

