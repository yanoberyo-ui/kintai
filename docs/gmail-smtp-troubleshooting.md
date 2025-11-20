# Gmail SMTP設定のトラブルシューティング

## 504エラーが発生する場合の確認事項

Gmail SMTPを設定しているのに504エラーが発生する場合、以下の点を確認してください。

## 1. Supabaseでの設定確認

### 必須設定項目

Supabaseダッシュボードで以下を確認：

1. **Host**
   - ✅ `smtp.gmail.com`（`https://`は不要）

2. **Port number**
   - ✅ `587`（推奨、TLS/STARTTLS用）
   - または `465`（SSL/TLS用）

3. **Username**
   - ✅ あなたのGmailアドレス（例: `your-email@gmail.com`）
   - ⚠️ スペースや特殊文字がないか確認

4. **Password**
   - ✅ アプリパスワード（16文字、スペースなし）
   - ⚠️ **重要**: スペースを削除して入力（`kfpl zymb pqzv ltpx` → `kfplzymbpqzvtpx`）
   - ⚠️ 通常のGmailパスワードではなく、**アプリパスワード**を使用

5. **Minimum interval per user**
   - ✅ `60`秒（デフォルト）

### 送信者情報の設定（重要）

Supabaseの設定画面で、以下も設定されているか確認：

- **Sender email**: あなたのGmailアドレス（例: `your-email@gmail.com`）
- **Sender name**: `FD GROUP 勤怠管理システム`（任意）

## 2. アプリパスワードの確認

### 正しいアプリパスワードの形式

- 16文字の英数字
- 4文字ずつスペースで区切られている場合がある
- **Supabaseに入力する際は、スペースを削除する**

例：
- 表示: `kfpl zymb pqzv ltpx`
- 入力: `kfplzymbpqzvtpx`

### アプリパスワードが正しく生成されているか確認

1. Googleアカウント設定 → セキュリティ
2. 「アプリパスワード」を確認
3. 「Supabase SMTP」などの名前でパスワードが生成されているか確認
4. 必要に応じて、新しいアプリパスワードを生成

## 3. 2段階認証の確認

アプリパスワードを使用するには、2段階認証が有効になっている必要があります：

1. Googleアカウント設定 → セキュリティ
2. 「2段階認証プロセス」が「オン」になっているか確認
3. オフの場合は、有効化してからアプリパスワードを再生成

## 4. Supabaseでのテスト

### テストメールの送信

1. Supabaseダッシュボード → 「Authentication」→「Email Templates」
2. 「Reset Password」テンプレートを選択
3. 「Send test email」ボタンをクリック
4. メールアドレスを入力して送信
5. メールが届くか確認

### エラーログの確認

1. Supabaseダッシュボード → 「Authentication」→「Users」
2. テストメールを送信したユーザーを検索
3. メール送信履歴を確認
4. エラーメッセージがないか確認

## 5. よくある設定ミス

### ❌ 間違った設定例

```
Host: https://smtp.gmail.com  ← https://は不要
Port: 25                      ← ポート25はブロックされている
Username: your-email          ← @gmail.comまで必要
Password: your-gmail-password ← 通常のパスワードではなくアプリパスワードが必要
```

### ✅ 正しい設定例

```
Host: smtp.gmail.com
Port: 587
Username: your-email@gmail.com
Password: kfplzymbpqzvtpx（スペースなし）
Minimum interval per user: 60
Sender email: your-email@gmail.com
Sender name: FD GROUP 勤怠管理システム
```

## 6. 設定の再確認手順

1. **Supabaseダッシュボードを開く**
   - 「Authentication」→「Settings」→「SMTP Settings」

2. **各項目を確認**
   - Host: `smtp.gmail.com`（スペースなし）
   - Port: `587`
   - Username: 完全なGmailアドレス
   - Password: アプリパスワード（スペースなし、16文字）

3. **送信者情報を確認**
   - Sender email: Gmailアドレス
   - Sender name: 任意の名前

4. **保存**
   - 「Save」をクリック
   - エラーメッセージがないか確認

5. **テスト**
   - テストメールを送信
   - メールが届くか確認

## 7. それでも解決しない場合

### 新しいアプリパスワードを生成

1. Googleアカウント設定 → セキュリティ
2. 「アプリパスワード」をクリック
3. 既存のパスワードを削除（必要に応じて）
4. 新しいアプリパスワードを生成
5. Supabaseの設定を更新

### ポート番号を変更

- `587`が動作しない場合、`465`を試す
- `465`が動作しない場合、`587`を試す

### Supabaseのサポートに問い合わせ

設定が正しいのに504エラーが続く場合：
- Supabaseダッシュボードの「Support」から問い合わせ
- エラーログと設定内容を共有

## チェックリスト

- [ ] Hostが `smtp.gmail.com` になっている（`https://`なし）
- [ ] Portが `587` または `465` になっている
- [ ] Usernameが完全なGmailアドレスになっている
- [ ] Passwordがアプリパスワードになっている（スペースなし）
- [ ] 2段階認証が有効になっている
- [ ] アプリパスワードが正しく生成されている
- [ ] Sender emailが設定されている
- [ ] Sender nameが設定されている
- [ ] 設定を保存している
- [ ] テストメールを送信して確認している

## まとめ

504エラーが発生する主な原因：

1. **アプリパスワードにスペースが含まれている**
   - 解決: スペースを削除して入力

2. **通常のGmailパスワードを使用している**
   - 解決: アプリパスワードを生成して使用

3. **送信者情報が設定されていない**
   - 解決: Sender emailとSender nameを設定

4. **2段階認証が有効になっていない**
   - 解決: 2段階認証を有効化してからアプリパスワードを生成

上記を確認して、再度お試しください。

