# パスワードリセット機能の設定ガイド

## Supabaseダッシュボードでの設定

パスワードリセット機能を有効にするには、Supabaseダッシュボードで以下の設定を行ってください。

### 1. Site URLの設定

1. Supabaseダッシュボードにログイン
2. 左側のメニューから「**Authentication**」を選択
3. 「**URL Configuration**」タブを開く
4. 「**Site URL**」にアプリのベースURLを設定
   - 開発環境: `http://localhost:5173`
   - 本番環境: `https://your-domain.com`

### 2. Redirect URLs（Direct URL）の設定

「**Redirect URLs**」セクションに、パスワードリセット後のリダイレクト先URLを追加します。

#### 設定するURL

以下のURLを追加してください：

```
http://localhost:5173/reset-password
https://your-domain.com/reset-password
```

**注意**: 開発環境と本番環境の両方のURLを追加することを推奨します。

#### 設定手順

1. 「**Redirect URLs**」の「**Add URL**」ボタンをクリック
2. 上記のURLを入力
3. 「**Save**」をクリック

### 3. メールテンプレートのカスタマイズ

パスワードリセットメールを綺麗な白黒デザインにカスタマイズする場合：

1. 「**Authentication**」→「**Email Templates**」を開く
2. 「**Reset Password**」テンプレートを選択
3. 「**Subject**」に件名を設定（例: `パスワードリセットのご案内`）
4. 「**Body**」に以下のHTMLテンプレートをコピー＆ペースト

#### カスタムHTMLテンプレート

`docs/password-reset-email-template.html` ファイルに、モダンで洗練された白黒デザインのHTMLテンプレートを用意しています。

**使い方：**
1. `docs/password-reset-email-template.html` を開く
2. ファイルの内容をすべてコピー
3. Supabaseダッシュボードの「Reset Password」テンプレートの「Body」に貼り付け
4. 「Save」をクリック

**テンプレートの特徴：**
- ✅ モダンで洗練された白黒デザイン
- ✅ レスポンシブ対応（モバイルでも見やすい）
- ✅ インラインスタイル使用（メールクライアント互換性）
- ✅ セキュリティ注意書き付き
- ✅ ボタンと代替リンクの両方を提供

## 動作確認

1. ログイン画面で「パスワードを忘れた場合」をクリック
2. メールアドレスを入力して「送信」をクリック
3. メールボックスを確認（数秒かかる場合があります）
4. メール内のリンクをクリック
5. 新しいパスワードを設定
6. ログイン画面に戻り、新しいパスワードでログイン

## カスタムSMTPの設定（推奨・完全無料）

無料プランの制限を回避し、確実にメールを送信するには、カスタムSMTPを設定することをお勧めします。

### Gmail SMTP（最も簡単・完全無料・推奨）

**Gmailのメリット：**
- ✅ 既存のGmailアカウントで使える
- ✅ 設定が最も簡単
- ✅ **完全無料**
- ✅ 1日500通まで送信可能

**設定手順：**
1. Gmailアプリパスワードを取得（詳細は `docs/free-smtp-setup.md` を参照）
2. SupabaseでSMTP設定：

```
Host: smtp.gmail.com
Port: 587
Username: 【あなたのGmailアドレス】
Password: 【16文字のアプリパスワード】
```

詳細な設定手順は `docs/free-smtp-setup.md` を参照してください。

### その他の無料SMTPプロバイダー

- **SendGrid**: 無料プランで1日100通（`docs/free-smtp-setup.md` を参照）
- **Mailgun**: 無料プランで1ヶ月5,000通（`docs/free-smtp-setup.md` を参照）
- **Resend**: 無料プランで1日3,000通（`docs/resend-setup-guide.md` を参照）

## トラブルシューティング

### メールが届かない場合

詳細なトラブルシューティングガイドは `docs/email-troubleshooting.md` を参照してください。

**すぐに確認すべきこと：**

1. **スパムフォルダを確認**
   - Gmail: 「スパム」フォルダ
   - Outlook: 「迷惑メール」フォルダ

2. **Supabaseダッシュボードで確認**
   - 「**Authentication**」→「**Users**」でメール送信ログを確認
   - エラーメッセージがないか確認

3. **Rate Limitの確認**
   - 無料プランでは1時間あたり最大4通のメール送信制限があります
   - 制限に達している場合は、しばらく待ってから再度試してください

4. **ブラウザのコンソールでエラーを確認**
   - F12キーで開発者ツールを開く
   - コンソールタブでエラーメッセージを確認
   - デバッグ情報が表示されます（🔐、✅、❌のアイコン付き）

5. **SMTP設定エラーの場合**
   - 「Missing SMTP_PASS fields」エラー: Passwordフィールドが正しく入力されているか確認
   - 「Custom SMTP required」エラー: 送信者情報（Sender email/name）を設定

### リダイレクトエラーが発生する場合

- 「**Redirect URLs**」に正しいURLが設定されているか確認
- URLの末尾にスラッシュ（`/`）がないか確認
- プロトコル（`http://` または `https://`）が正しいか確認

### パスワードリセットページが表示されない場合

- ブラウザのコンソールでエラーを確認
- URLに`#access_token=...&type=recovery`が含まれているか確認
- 開発サーバーが起動しているか確認

## 技術的な詳細

パスワードリセットのフロー：

1. ユーザーがメールアドレスを入力して送信
2. Supabaseがパスワードリセットメールを送信
3. メール内のリンクには`access_token`と`type=recovery`が含まれる
4. リンクをクリックすると、設定したRedirect URLにリダイレクト
5. アプリがURLパラメータを検出してパスワードリセットページを表示
6. ユーザーが新しいパスワードを設定
7. `supabase.auth.updateUser()`でパスワードを更新

