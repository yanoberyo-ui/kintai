# SquarespaceでDNSレコードを設定する方法

forestdali.bizがSquarespaceで管理されている場合のDNSレコード設定手順を説明します。

## SquarespaceでのDNS設定手順

### ステップ1: Squarespaceにログイン

1. **Squarespaceにアクセス**
   - https://www.squarespace.com にアクセス
   - または https://account.squarespace.com にアクセス

2. **アカウントでログイン**
   - forestdali.bizを管理しているアカウントでログイン

### ステップ2: ドメイン設定を開く

1. **「設定」または「Settings」を開く**
   - 左メニューまたは上部メニューから「設定」を選択

2. **「ドメイン」または「Domains」を開く**
   - 設定メニューから「ドメイン」を選択

3. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizを選択

### ステップ3: DNS設定を開く

1. **「DNS設定」または「DNS Settings」を開く**
   - forestdali.bizの詳細画面で「DNS設定」を探す
   - または「高度な設定」→「DNS設定」を開く

2. **「カスタムDNSレコード」セクションを開く**
   - 「カスタムDNSレコード」または「Custom DNS Records」セクションを探す

### ステップ4: ResendのDNSレコードを追加

SquarespaceのDNS設定画面で、以下のレコードを追加します。

#### 1. TXTレコード（DKIM）を追加

「レコードを追加」または「Add Record」をクリック：

```
タイプ: TXT
ホスト名: resend._domainkey
値（データ）: p=MIGfMA0GCSqGSIb3DQEB...（Resendが表示している完全な値をコピー）
TTL: 3600（またはデフォルト値）
```

「保存」または「Add」をクリック

#### 2. MXレコードを追加

「レコードを追加」または「Add Record」をクリック：

```
タイプ: MX
ホスト名: send
値（データ）: feedback-smtp.ap-northeast-1.amazonses.com（完全な値）
優先度: 10
TTL: 3600（またはデフォルト値）
```

「保存」または「Add」をクリック

#### 3. TXTレコード（SPF）を追加

「レコードを追加」または「Add Record」をクリック：

```
タイプ: TXT
ホスト名: send
値（データ）: v=spf1 include:amazonses.com ~all（完全な値）
TTL: 3600（またはデフォルト値）
```

「保存」または「Add」をクリック

#### 4. TXTレコード（DMARC）を追加（オプション）

「レコードを追加」または「Add Record」をクリック：

```
タイプ: TXT
ホスト名: _dmarc
値（データ）: v=DMARC1; p=none;
TTL: 3600（またはデフォルト値）
```

「保存」または「Add」をクリック

### ステップ5: 保存と確認

1. **すべてのレコードを追加したら保存**
   - 各レコードを追加した後、「保存」または「確定」をクリック

2. **DNSの反映を待つ**
   - DNSレコードの反映には数分〜数時間かかります
   - 通常は10分〜1時間程度

3. **Resendダッシュボードで確認**
   - Resendダッシュボードに戻る
   - forestdali.bizドメインのページを開く
   - DNSレコードのステータスを確認
   - すべてのレコードが「Verified」になるまで待つ

## SquarespaceのDNS設定画面の見方

SquarespaceのDNS設定画面では、以下のような形式で表示されます：

- **タイプ**: レコードの種類（TXT、MXなど）
- **ホスト名**: サブドメイン部分（例: `resend._domainkey`、`send`）
- **値（データ）**: レコードの値
- **優先度**: MXレコードの場合のみ（例: 10）
- **TTL**: レコードの有効期限（通常は3600）

**注意**: 
- ホスト名には、サブドメイン部分のみを入力します（`forestdali.biz`は自動的に追加されます）
- 例: `resend._domainkey` と入力すると、`resend._domainkey.forestdali.biz` として設定されます

## トラブルシューティング

### DNS設定画面が見つからない場合

1. **「設定」→「ドメイン」→ forestdali.biz → 「高度な設定」を確認**
   - DNS設定は「高度な設定」セクションにある可能性があります

2. **「外部DNS」または「External DNS」を確認**
   - Squarespaceで外部DNSを使用している場合、別の設定画面がある可能性があります

3. **Squarespaceサポートに問い合わせ**
   - DNSレコードの設定方法について問い合わせ

### DNSレコードが反映されない場合

1. **レコードが正しく追加されているか確認**
   - SquarespaceのDNS設定画面で確認
   - タイポがないか確認

2. **DNSの反映を待つ**
   - DNSの反映には時間がかかります
   - 数時間待ってから再度確認

3. **DNSチェックツールで確認**
   - https://mxtoolbox.com にアクセス
   - 「DNS Lookup」で `resend._domainkey.forestdali.biz` を検索
   - レコードが正しく設定されているか確認

## チェックリスト

- [ ] Squarespaceにログイン
- [ ] 「設定」→「ドメイン」を開く
- [ ] forestdali.bizを選択
- [ ] 「DNS設定」または「高度な設定」→「DNS設定」を開く
- [ ] 「カスタムDNSレコード」セクションを開く
- [ ] TXTレコード（DKIM）を追加: `resend._domainkey`
- [ ] MXレコードを追加: `send` (Priority: 10)
- [ ] TXTレコード（SPF）を追加: `send`
- [ ] TXTレコード（DMARC）を追加: `_dmarc`（オプション）
- [ ] すべてのレコードを保存
- [ ] DNSの反映を待つ（数分〜数時間）
- [ ] Resendダッシュボードで検証状況を確認

## まとめ

Squarespaceでforestdali.bizを管理している場合：

1. ✅ **Squarespaceにログイン**
2. ✅ **「設定」→「ドメイン」→ forestdali.bizを選択**
3. ✅ **「DNS設定」または「高度な設定」→「DNS設定」を開く**
4. ✅ **「カスタムDNSレコード」セクションでResendのDNSレコードを追加**
5. ✅ **保存してDNSの反映を待つ**
6. ✅ **Resendダッシュボードで検証状況を確認**

DNSレコードの設定が完了すると、forestdali.bizドメインからメールを送信できるようになります！

