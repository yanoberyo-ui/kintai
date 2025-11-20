# Resendでforestdali.bizドメインを使用する設定方法

Resendを使用して、forestdali.bizドメインからメールを送信する設定方法を説明します。

## Resendのメリット

- ✅ 無料プランで1日3,000通まで送信可能
- ✅ 設定が簡単
- ✅ メールの到達率が高い
- ✅ ドメイン認証が簡単

## ステップ1: Resendアカウントの作成

1. **Resendにアクセス**
   - https://resend.com にアクセス

2. **アカウント作成**
   - 「Sign Up」をクリック
   - メールアドレスとパスワードでアカウント作成
   - メール認証を完了

## ステップ2: API Keyの取得

1. **Resendダッシュボードにログイン**
   - https://resend.com/dashboard にアクセス

2. **API Keysを開く**
   - 左メニューから「**API Keys**」をクリック

3. **API Keyを生成**
   - 「**Create API Key**」をクリック
   - 名前を入力（例: `Supabase SMTP`）
   - 権限を選択（`Sending access` を選択）
   - 「**Add**」をクリック

4. **API Keyをコピー**
   - **API Keyをコピー**（一度しか表示されないので注意）
   - 例: `re_1234567890abcdefghijklmnopqrstuvwxyz`

## ステップ3: ドメインの検証（forestdali.biz）

forestdali.bizドメインからメールを送信するには、ドメインの検証が必要です。

### 3.1 ドメインを追加

1. **Resendダッシュボードで「Domains」を開く**
   - 左メニューから「**Domains**」をクリック

2. **ドメインを追加**
   - 「**Add Domain**」をクリック
   - ドメイン名を入力: `forestdali.biz`
   - 「**Add**」をクリック

### 3.2 DNSレコードを設定

Resendが提供するDNSレコードを、forestdali.bizのDNS設定に追加する必要があります。

1. **Resendが提供するDNSレコードを確認**
   - 以下のようなレコードが表示されます：

```
Type: TXT
Name: @
Value: 【Resendが提供する値】

Type: MX
Name: @
Value: feedback-smtp.resend.com
Priority: 10

Type: CNAME
Name: resend._domainkey
Value: 【Resendが提供する値】
```

2. **DNSプロバイダーでレコードを追加**
   - forestdali.bizのDNS管理画面にアクセス
   - 上記のDNSレコードを追加
   - 保存

3. **検証を待つ**
   - DNSレコードの反映には数分〜数時間かかる場合があります
   - Resendダッシュボードで検証状況を確認

### 3.3 検証が完了したら

- ドメインのステータスが「Verified」になるまで待つ
- 検証が完了すると、`yamamotoikki@forestdali.biz` からメールを送信できるようになります

## ステップ4: SupabaseでSMTP設定

1. **Supabaseダッシュボードにログイン**
   - 「Authentication」→「Settings」を開く
   - 「SMTP Settings」セクションを開く
   - 「Enable Custom SMTP」をONにする

2. **以下の設定を入力：**

```
Host: smtp.resend.com
Port number: 587
Username: resend
Password: 【Resend API Key】（ステップ2で取得したもの）
Minimum interval per user: 60
```

3. **送信者情報を設定：**

```
Sender email: yamamotoikki@forestdali.biz（検証済みドメインのメールアドレス）
Sender name: FD Hub
```

4. **保存**
   - 「Save」をクリック
   - エラーメッセージがないか確認

## ステップ5: テスト

1. **Supabaseダッシュボードでテストメールを送信**
   - 「Authentication」→「Email Templates」→「Reset Password」
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
- Host: smtp.resend.com ✅
- Port: 587 ✅
- Username: resend ✅
- Password: 【Resend API Key】✅
- Minimum interval per user: 60 ✅
```

## トラブルシューティング

### ドメインの検証が完了しない場合

1. **DNSレコードが正しく設定されているか確認**
   - DNSプロバイダーの設定を確認
   - レコードが正しく追加されているか確認

2. **DNSの反映を待つ**
   - DNSレコードの反映には時間がかかる場合があります
   - 数時間待ってから再度確認

3. **Resendのサポートに問い合わせ**
   - 検証が完了しない場合は、Resendのサポートに問い合わせ

### メールが届かない場合

1. **Resendダッシュボードで確認**
   - 「Logs」タブでメール送信履歴を確認
   - エラーメッセージがないか確認

2. **スパムフォルダを確認**
   - メールがスパムフォルダに入っている可能性があります

3. **API Keyが正しいか確認**
   - Supabaseの設定でAPI Keyが正しく入力されているか確認

## 料金プラン

- **無料プラン**: 1日3,000通まで送信可能
- **Proプラン**: $20/月（1日50,000通まで）

開発環境や小規模な運用であれば、無料プランで十分です。

## まとめ

Resendを使用することで：

1. ✅ 設定が簡単
2. ✅ forestdali.bizドメインからメールを送信可能
3. ✅ メールの到達率が高い
4. ✅ 無料プランで十分な送信量

設定が完了したら、パスワードリセット機能をテストしてください！

