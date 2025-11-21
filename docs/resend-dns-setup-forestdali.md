# Resend DNS設定ガイド（forestdali.biz）

forestdali.bizドメインでResendを使用するために、DNSレコードを設定する必要があります。

## 現在の状況

- ドメインステータス: **Pending**（保留中）
- DNSレコードの検証待ち

## 設定が必要なDNSレコード

Resendダッシュボードに表示されているDNSレコードを、forestdali.bizのDNSプロバイダーに追加する必要があります。

### 1. Domain Verification (DKIM)

**TXTレコード**を追加：

```
Type: TXT
Name: resend._domainkey
Content: p=MIGfMA0GCSqGSIb3DQEB...（Resendが提供する完全な値）
TTL: Auto（または3600）
```

### 2. Enable Sending (SPF & DMARC)

**MXレコード**を追加：

```
Type: MX
Name: send
Content: feedback-smtp.ap-northeast-1.amazonses.com（完全な値）
TTL: Auto（または3600）
Priority: 10
```

**TXTレコード（SPF）**を追加：

```
Type: TXT
Name: send
Content: v=spf1 include:amazonses.com ~all（完全な値）
TTL: Auto（または3600）
```

**TXTレコード（DMARC）**を追加（オプション）：

```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none;
TTL: Auto（または3600）
```

## DNS設定手順

### ステップ1: DNSプロバイダーにアクセス

forestdali.bizのDNS管理画面にアクセスします。

**一般的なDNSプロバイダー：**
- Cloudflare
- Google Domains
- Namecheap
- GoDaddy
- Route 53
- その他のドメインレジストラ

### ステップ2: DNSレコードを追加

DNS管理画面で、上記のDNSレコードを追加します。

**注意事項：**
- Nameフィールドには、サブドメイン部分のみを入力（例: `resend._domainkey`、`send`）
- Contentフィールドには、Resendが提供する完全な値をコピー＆ペースト
- TTLはAutoまたは3600を推奨

### ステップ3: DNSの反映を待つ

DNSレコードの反映には時間がかかります：

- **通常**: 数分〜1時間
- **最大**: 24時間（DNSプロバイダーによって異なる）

### ステップ4: Resendで検証状況を確認

1. Resendダッシュボードに戻る
2. forestdali.bizドメインのページを開く
3. DNSレコードのステータスを確認
4. すべてのレコードが「Verified」になるまで待つ

## 各DNSレコードの説明

### Domain Verification (DKIM)

- **目的**: ドメインの所有権を確認
- **必須**: ✅ はい
- **説明**: メールの送信元が正当であることを証明

### Enable Sending (SPF & DMARC)

- **目的**: メール送信を有効化
- **必須**: ✅ はい
- **説明**: SPFレコードで送信サーバーを認証、DMARCでポリシーを設定

### Enable Receiving (MX)

- **目的**: メール受信を有効化
- **必須**: ❌ いいえ（パスワードリセットメールの送信のみの場合は不要）
- **説明**: メールを受信する場合のみ設定が必要

## トラブルシューティング

### DNSレコードが反映されない場合

1. **DNSプロバイダーで確認**
   - レコードが正しく追加されているか確認
   - タイポがないか確認

2. **DNSの反映を待つ**
   - DNSの反映には時間がかかります
   - 数時間待ってから再度確認

3. **DNSチェックツールを使用**
   - https://mxtoolbox.com などのツールでDNSレコードを確認
   - レコードが正しく設定されているか確認

### ステータスが「Pending」のままの場合

1. **DNSレコードを再確認**
   - すべてのレコードが正しく設定されているか確認
   - NameとContentが正確か確認

2. **TTLを確認**
   - TTLが短すぎる場合、反映が遅れる可能性があります
   - 3600（1時間）を推奨

3. **Resendのサポートに問い合わせ**
   - 24時間経過しても検証が完了しない場合、Resendのサポートに問い合わせ

## 検証が完了したら

DNSレコードの検証が完了すると：

1. **ドメインステータスが「Verified」に変わる**
2. **Sender emailを更新**
   - Supabaseの設定で、Sender emailを `yamamotoikki@forestdali.biz` に変更
   - または `noreply@forestdali.biz` などの任意のメールアドレスを使用可能

3. **テストメールを送信**
   - Supabaseダッシュボードでテストメールを送信
   - forestdali.bizドメインからメールが送信されることを確認

## まとめ

DNSレコードの設定手順：

1. ✅ ResendダッシュボードでDNSレコードを確認
2. ✅ forestdali.bizのDNSプロバイダーでレコードを追加
3. ✅ DNSの反映を待つ（数分〜数時間）
4. ✅ Resendで検証状況を確認
5. ✅ 検証完了後、SupabaseのSender emailを更新

DNSレコードの設定が完了するまで、`onboarding@resend.dev` を使用してテストできます。

