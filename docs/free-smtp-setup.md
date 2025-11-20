# 完全無料でSupabaseメール送信を設定する方法

課金不要でメール送信を設定する方法を説明します。

## 方法1: Gmail SMTP（最も簡単・推奨）

Gmailアカウントがあれば、完全無料でメール送信が可能です。

### ステップ1: Gmailアプリパスワードの取得

1. **Googleアカウントのセキュリティ設定を開く**
   - https://myaccount.google.com/security にアクセス
   - または Googleアカウント設定 → セキュリティ

2. **2段階認証を有効化**
   - 「2段階認証プロセス」をクリック
   - 有効化していない場合は、設定手順に従って有効化

3. **アプリパスワードを生成**
   - 「アプリパスワード」をクリック
   - まだ表示されない場合は、2段階認証を有効化してから数分待つ
   - 「アプリを選択」→「メール」を選択
   - 「デバイスを選択」→「その他（カスタム名）」を選択
   - 名前を入力（例: `Supabase SMTP`）
   - 「生成」をクリック
   - **16文字のパスワードをコピー**（一度しか表示されないので注意）

### ステップ2: SupabaseでSMTP設定

1. Supabaseダッシュボードにログイン
2. 「**Authentication**」→「**Settings**」を開く
3. 「**SMTP Settings**」セクションを開く
4. 「**Enable Custom SMTP**」をONにする
5. 以下の設定を入力：

```
Host: smtp.gmail.com
Port number: 587
Username: 【あなたのGmailアドレス】（例: your-email@gmail.com）
Password: 【16文字のアプリパスワード】（ステップ1で取得したもの）
Minimum interval per user: 60
```

6. **送信者情報も設定**（重要）
   - 「**Sender email**」: あなたのGmailアドレス（例: `your-email@gmail.com`）
   - 「**Sender name**」: `FD GROUP 勤怠管理システム`

7. 「**Save**」をクリック

### ステップ3: テスト

1. 「**Authentication**」→「**Email Templates**」を開く
2. 「**Reset Password**」テンプレートを選択
3. 「**Send test email**」ボタンをクリック
4. メールアドレスを入力して送信
5. メールが届くか確認

### Gmailの制限事項

- **1日あたり500通まで**送信可能（通常の運用では十分）
- 送信元がGmailアドレスとして表示される
- スパム判定される可能性が少し高い（ただし、通常は問題なし）

## 方法2: SendGrid（無料プランあり）

SendGridは無料プランで1日100通まで送信可能です。

### ステップ1: SendGridアカウント作成

1. https://sendgrid.com にアクセス
2. 「Sign Up」をクリック
3. 無料プランでアカウント作成
4. メール認証を完了

### ステップ2: API Keyの取得

1. SendGridダッシュボードにログイン
2. 「**Settings**」→「**API Keys**」をクリック
3. 「**Create API Key**」をクリック
4. 名前を入力（例: `Supabase SMTP`）
5. 「**Full Access**」または「**Restricted Access**」→「**Mail Send**」を選択
6. 「**Create & View**」をクリック
7. **API Keyをコピー**（一度しか表示されないので注意）

### ステップ3: 送信者メールアドレスの検証

1. 「**Settings**」→「**Sender Authentication**」をクリック
2. 「**Verify a Single Sender**」をクリック
3. メールアドレスを入力して検証
4. 送信されたメールのリンクをクリックして検証完了

### ステップ4: SupabaseでSMTP設定

```
Host: smtp.sendgrid.net
Port number: 587
Username: apikey
Password: 【SendGrid API Key】（ステップ2で取得したもの）
Minimum interval per user: 60
```

**送信者情報：**
- 「**Sender email**」: 検証済みのメールアドレス
- 「**Sender name**」: `FD GROUP 勤怠管理システム`

### SendGridの制限事項

- 無料プランで1日100通まで
- 送信者メールアドレスの検証が必要

## 方法3: Mailgun（無料プランあり）

Mailgunは無料プランで1ヶ月5,000通まで送信可能です。

### ステップ1: Mailgunアカウント作成

1. https://www.mailgun.com にアクセス
2. 「Sign Up」をクリック
3. 無料プランでアカウント作成
4. メール認証を完了

### ステップ2: SMTP認証情報の取得

1. Mailgunダッシュボードにログイン
2. 「**Sending**」→「**SMTP credentials**」をクリック
3. 「**Create SMTP credentials**」をクリック
4. ユーザー名とパスワードを設定
5. **認証情報をコピー**

### ステップ3: ドメインの検証

1. 「**Sending**」→「**Domains**」をクリック
2. サンドボックスドメイン（`sandbox12345.mailgun.org`）を使用するか、独自ドメインを追加
3. DNSレコードを設定して検証

### ステップ4: SupabaseでSMTP設定

```
Host: smtp.mailgun.org
Port number: 587
Username: 【Mailgun SMTP Username】（ステップ2で取得したもの）
Password: 【Mailgun SMTP Password】（ステップ2で取得したもの）
Minimum interval per user: 60
```

**送信者情報：**
- 「**Sender email**」: 検証済みドメインのメールアドレス
- 「**Sender name**」: `FD GROUP 勤怠管理システム`

### Mailgunの制限事項

- 無料プランで1ヶ月5,000通まで
- ドメインの検証が必要（サンドボックスドメインでも可）

## おすすめの選択

### 最も簡単: Gmail
- ✅ 既存のアカウントで使える
- ✅ 設定が最も簡単
- ✅ 完全無料
- ✅ 1日500通まで送信可能

### より多くの送信が必要: SendGrid
- ✅ 無料プランで1日100通
- ✅ 設定が比較的簡単
- ✅ メールの到達率が高い

### 大量送信が必要: Mailgun
- ✅ 無料プランで1ヶ月5,000通
- ⚠️ 設定が少し複雑（ドメイン検証が必要）

## トラブルシューティング

### 「Missing SMTP_PASS fields」エラー

**原因**: Passwordフィールドが正しく入力されていない

**解決策**:
- パスワードが正しくコピーされているか確認
- スペースや改行が含まれていないか確認
- Gmailの場合は、通常のパスワードではなく**アプリパスワード**を使用

### 「Custom SMTP required」エラー

**原因**: 送信者情報が設定されていない

**解決策**:
- 「**Sender email**」と「**Sender name**」を設定
- メールアドレスは検証済みのものを使用

### メールが届かない場合

1. **スパムフォルダを確認**
2. **SMTP設定が正しいか確認**
3. **送信者メールアドレスが検証済みか確認**
4. **テストメールを送信して確認**

## まとめ

**初心者・すぐに始めたい**: Gmail（最も簡単）
**少し設定できる**: SendGrid（1日100通）
**大量送信が必要**: Mailgun（1ヶ月5,000通）

どの方法も完全無料で使えます！

