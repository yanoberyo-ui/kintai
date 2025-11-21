# Resend API Keyを使用したSupabase SMTP設定

## Supabaseでの設定手順

Resend API Key: `re_KmzLysB9_LoB9fbdedbitE1NWCbcSCQg3`

### ステップ1: Supabaseダッシュボードを開く

1. Supabaseダッシュボードにログイン
2. 「**Authentication**」→「**Settings**」を開く
3. 「**SMTP Settings**」セクションを開く
4. 「**Enable Custom SMTP**」をONにする

### ステップ2: SMTP設定を入力

以下の設定を入力してください：

```
Host: smtp.resend.com
Port number: 587
Username: resend
Password: re_KmzLysB9_LoB9fbdedbitE1NWCbcSCQg3
Minimum interval per user: 60
```

### ステップ3: 送信者情報を設定

```
Sender email: onboarding@resend.dev（テスト用）
または: yamamotoikki@forestdali.biz（forestdali.bizドメインを検証済みの場合）

Sender name: FD Hub
```

**注意**: 
- 最初は `onboarding@resend.dev` を使用してテストできます
- forestdali.bizドメインの検証が完了したら、`yamamotoikki@forestdali.biz` に変更できます

### ステップ4: 保存

1. 「**Save**」ボタンをクリック
2. エラーメッセージがないか確認
3. 成功メッセージが表示されることを確認

### ステップ5: テストメールを送信

1. 「**Authentication**」→「**Email Templates**」を開く
2. 「**Reset Password**」テンプレートを選択
3. 「**Send test email**」ボタンをクリック
4. メールアドレスを入力して送信
5. メールが届くか確認

## 設定の全体像

```
Sender details:
- Sender email: onboarding@resend.dev（または yamamotoikki@forestdali.biz）
- Sender name: FD Hub

SMTP provider settings:
- Host: smtp.resend.com
- Port: 587
- Username: resend
- Password: re_KmzLysB9_LoB9fbdedbitE1NWCbcSCQg3
- Minimum interval per user: 60
```

## トラブルシューティング

### エラー: "Missing SMTP_PASS fields"

**原因**: Passwordフィールドが正しく入力されていない

**解決策**:
- API Keyが正しくコピーされているか確認
- スペースや改行が含まれていないか確認
- 再度コピー＆ペーストしてみる

### エラー: "Custom SMTP required to configure SMTP_SENDER_NAME"

**原因**: 送信者情報が設定されていない

**解決策**:
- 「**Sender email**」と「**Sender name**」を設定
- 最初は `onboarding@resend.dev` を使用

### メールが届かない場合

1. **Resendダッシュボードで確認**
   - 「**Logs**」タブでメール送信履歴を確認
   - エラーメッセージがないか確認

2. **スパムフォルダを確認**
   - メールがスパムフォルダに入っている可能性があります

3. **送信者メールアドレスを確認**
   - `onboarding@resend.dev` を使用している場合、一部のメールプロバイダーでブロックされる可能性があります

## 次のステップ

1. **設定を保存**
   - Supabaseで上記の設定を入力して保存

2. **テストメールを送信**
   - Supabaseダッシュボードでテストメールを送信
   - アプリでパスワードリセットをテスト

3. **forestdali.bizドメインの検証（オプション）**
   - Resendでforestdali.bizドメインを追加
   - DNSレコードを設定して検証
   - 検証完了後、Sender emailを `yamamotoikki@forestdali.biz` に変更

## まとめ

設定が完了したら、パスワードリセット機能をテストしてください。Resendは設定が簡単で、メールの到達率も高いので、問題なく動作するはずです！

