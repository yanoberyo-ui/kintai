# ResendでSupabaseメール送信を設定する方法

Resendは開発者向けのメール送信サービスで、設定が簡単でSupabaseとの連携もスムーズです。

## Resendのメリット

- ✅ 無料プランで1日3,000通まで送信可能
- ✅ 設定が簡単
- ✅ メールの到達率が高い
- ✅ 開発者向けのドキュメントが充実
- ✅ Supabaseとの連携が簡単

## ステップ1: Resendアカウントの作成

1. https://resend.com にアクセス
2. 「Sign Up」をクリック
3. メールアドレスとパスワードでアカウント作成
4. メール認証を完了

## ステップ2: API Keyの取得

1. Resendダッシュボードにログイン
2. 左メニューから「**API Keys**」をクリック
3. 「**Create API Key**」をクリック
4. 名前を入力（例: `Supabase SMTP`）
5. 権限を選択（`Sending access` を選択）
6. 「**Add**」をクリック
7. **API Keyをコピー**（一度しか表示されないので注意）

## ステップ3: ドメインの検証（オプション）

**重要**: 本番環境で使用する場合は、独自ドメインの検証が必要です。

1. 「**Domains**」をクリック
2. 「**Add Domain**」をクリック
3. ドメインを入力（例: `yourdomain.com`）
4. DNSレコードを設定（Resendが提供するレコードをDNSに追加）
5. 検証が完了するまで待つ（通常数分〜数時間）

**開発環境の場合**: 検証済みドメインがなくても、Resendのテストドメイン（`onboarding.resend.dev`）を使用できます。

## ステップ4: SupabaseでのSMTP設定

1. Supabaseダッシュボードにログイン
2. 「**Authentication**」→「**Settings**」を開く
3. 「**SMTP Settings**」セクションを開く
4. 「**Enable Custom SMTP**」をONにする
5. 以下の設定を入力：

```
Host: smtp.resend.com
Port number: 587
Username: resend
Password: 【Resend API Key】（ステップ2で取得したもの）
Minimum interval per user: 60
```

6. 「**Save**」をクリック

## ステップ5: 送信者情報の設定

Supabaseの設定画面で、以下の情報も設定する必要があります：

1. 「**Sender email**」: 検証済みのメールアドレスまたはドメイン
   - 例: `noreply@yourdomain.com`
   - または: `onboarding@resend.dev`（テスト用）

2. 「**Sender name**」: 送信者名
   - 例: `FD GROUP 勤怠管理システム`

## ステップ6: テストメールの送信

1. 「**Authentication**」→「**Email Templates**」を開く
2. 「**Reset Password**」テンプレートを選択
3. 「**Send test email**」ボタンをクリック
4. メールアドレスを入力して送信
5. メールが届くか確認

## トラブルシューティング

### エラー: "Missing SMTP_PASS fields"

**原因**: Passwordフィールドが正しく入力されていない

**解決策**:
- Resend API Keyが正しくコピーされているか確認
- スペースや改行が含まれていないか確認
- 再度コピー＆ペーストしてみる

### エラー: "Custom SMTP required to configure SMTP_SENDER_NAME"

**原因**: 送信者情報が設定されていない

**解決策**:
- 「**Sender email**」と「**Sender name**」を設定
- メールアドレスは検証済みドメインまたはResendのテストドメインを使用

### メールが届かない場合

1. **Resendダッシュボードで確認**
   - 「**Logs**」タブでメール送信履歴を確認
   - エラーメッセージがないか確認

2. **スパムフォルダを確認**
   - メールがスパムフォルダに入っている可能性があります

3. **送信者メールアドレスを確認**
   - 検証済みドメインを使用しているか確認
   - テストドメイン（`onboarding@resend.dev`）を使用している場合、一部のメールプロバイダーでブロックされる可能性があります

## 料金プラン

- **無料プラン**: 1日3,000通まで
- **Proプラン**: $20/月（1日50,000通まで）

開発環境や小規模な運用であれば、無料プランで十分です。

## 次のステップ

設定が完了したら：

1. パスワードリセット機能をテスト
2. Resendダッシュボードの「**Logs**」で送信履歴を確認
3. メールの到達率をモニタリング

## 参考リンク

- Resend公式サイト: https://resend.com
- Resendドキュメント: https://resend.com/docs
- Supabase SMTP設定: https://supabase.com/docs/guides/auth/auth-smtp

