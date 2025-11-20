# Google Workspace SMTP設定ガイド（forestdali.biz）

Google Workspaceを使用している場合のSMTP設定方法を説明します。

## Google WorkspaceのSMTP設定

Google Workspaceでも、Gmailと同じSMTPサーバーを使用できます。

### ステップ1: アプリパスワードの生成

Google Workspaceアカウントでアプリパスワードを生成します。

#### 方法A: 通常のGoogleアカウント設定から（推奨）

1. **Googleアカウント設定を開く**
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

#### 方法B: Google Workspace管理コンソールから

Google Workspace管理者がアプリパスワードを有効にしている必要があります。

1. **Google Workspace管理コンソールにアクセス**
   - https://admin.google.com にアクセス
   - 管理者アカウントでログイン

2. **セキュリティ設定を確認**
   - 「セキュリティ」→「API制御」を開く
   - 「アプリパスワード」が有効になっているか確認

3. **ユーザーアカウントでアプリパスワードを生成**
   - ユーザーアカウント設定からアプリパスワードを生成（方法Aと同じ）

### ステップ2: SupabaseでSMTP設定

1. **Supabaseダッシュボードにログイン**
   - 「Authentication」→「Settings」を開く
   - 「SMTP Settings」セクションを開く
   - 「Enable Custom SMTP」をONにする

2. **以下の設定を入力：**

```
Host: smtp.gmail.com
Port number: 587
Username: yamamotoikki@forestdali.biz
Password: 【16文字のアプリパスワード】（スペースなし）
Minimum interval per user: 60
```

3. **送信者情報を設定（重要）：**

```
Sender email: yamamotoikki@forestdali.biz
Sender name: FD Hub（または任意の名前）
```

4. **保存**
   - 「Save」をクリック
   - エラーメッセージがないか確認

### ステップ3: テスト

1. **Supabaseダッシュボードでテストメールを送信**
   - 「Authentication」→「Email Templates」を開く
   - 「Reset Password」テンプレートを選択
   - 「Send test email」ボタンをクリック
   - メールアドレスを入力して送信
   - メールが届くか確認

2. **アプリでパスワードリセットをテスト**
   - ログイン画面で「パスワードを忘れた場合」をクリック
   - メールアドレスを入力して送信
   - メールが届くか確認

## 正しい設定の全体像

```
Sender details:
- Sender email: yamamotoikki@forestdali.biz ✅
- Sender name: FD Hub ✅

SMTP provider settings:
- Host: smtp.gmail.com ✅
- Port: 587 ✅
- Username: yamamotoikki@forestdali.biz ✅
- Password: 【16文字のアプリパスワード】（スペースなし）✅
- Minimum interval per user: 60 ✅
```

## よくある問題と解決策

### 問題1: アプリパスワードが生成できない

**原因**: 
- 2段階認証が有効になっていない
- Google Workspace管理者がアプリパスワードを無効にしている

**解決策**:
1. 2段階認証を有効化
2. Google Workspace管理者に確認（アプリパスワードが有効か）
3. 必要に応じて、管理者にアプリパスワードの有効化を依頼

### 問題2: 500エラー「Error sending recovery email」

**原因**: 
- アプリパスワードが間違っている
- 送信者メールアドレスとSMTP設定が一致していない
- SMTP設定が保存されていない

**解決策**:
1. アプリパスワードを再生成
2. Supabaseの設定を確認（送信者メールアドレスとUsernameが一致しているか）
3. 「Save」をクリックして保存を確認
4. テストメールを送信して確認

### 問題3: メールが届かない

**原因**: 
- スパムフォルダに入っている
- メールアドレスが間違っている
- SMTP設定が正しくない

**解決策**:
1. スパムフォルダを確認
2. メールアドレスが正しいか確認
3. Supabaseダッシュボードでテストメールを送信
4. エラーログを確認

## チェックリスト

- [ ] 2段階認証が有効になっている
- [ ] アプリパスワードが生成されている（16文字）
- [ ] Hostが `smtp.gmail.com` になっている
- [ ] Portが `587` になっている
- [ ] Usernameが `yamamotoikki@forestdali.biz` になっている
- [ ] Passwordがアプリパスワードになっている（スペースなし）
- [ ] Sender emailが `yamamotoikki@forestdali.biz` になっている
- [ ] Sender nameが設定されている
- [ ] 設定を保存している
- [ ] テストメールを送信して確認している

## 注意事項

### Google Workspaceの制限

- **1日あたり500通まで**送信可能（通常の運用では十分）
- 送信元が `yamamotoikki@forestdali.biz` として表示される
- スパム判定される可能性が少し高い（ただし、通常は問題なし）

### セキュリティ

- アプリパスワードは一度しか表示されないので、必ずコピーして保存
- アプリパスワードは通常のパスワードとは別物
- アプリパスワードが漏洩した場合は、すぐに削除して新しいものを生成

## まとめ

Google Workspaceを使用している場合でも、Gmailと同じSMTP設定（`smtp.gmail.com`）を使用できます。

重要なポイント：
1. **アプリパスワードを生成**（2段階認証が必要）
2. **送信者メールアドレスとUsernameを一致させる**（`yamamotoikki@forestdali.biz`）
3. **設定を保存してテスト**

設定が完了したら、パスワードリセット機能をテストしてください！

