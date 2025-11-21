# DNSレコードを追加する場所

forestdali.bizのDNSレコードを追加する場所を説明します。

## DNSレコードはどこで設定するか

DNSレコードは、**forestdali.bizドメインを管理しているDNSプロバイダー**で設定する必要があります。

Google Workspaceの管理画面ではなく、**ドメインのDNS管理画面**で設定します。

## forestdali.bizのDNSプロバイダーを確認する方法

### 方法1: WHOISで確認

1. https://whois.net にアクセス
2. `forestdali.biz` を検索
3. 「Name Servers」または「DNS Servers」を確認
4. 表示されたネームサーバーからDNSプロバイダーを特定

### 方法2: ドメインレジストラを確認

forestdali.bizを購入した場所（ドメインレジストラ）を確認：

- **Google Domains**（現在はSquarespaceに移行）
- **Namecheap**
- **GoDaddy**
- **Cloudflare**
- **Route 53**
- **その他のレジストラ**

## 一般的なDNSプロバイダーでの設定方法

### Google Domains / Squarespaceの場合

1. **Google Domainsにログイン**
   - https://domains.google.com にアクセス
   - または Squarespace Domains（移行後）

2. **ドメインを選択**
   - forestdali.bizを選択

3. **DNS設定を開く**
   - 「DNS」または「DNS設定」をクリック

4. **カスタムレコードを追加**
   - 「カスタムレコード」セクションを開く
   - Resendが提供するDNSレコードを追加

### Cloudflareの場合

1. **Cloudflareにログイン**
   - https://dash.cloudflare.com にアクセス

2. **ドメインを選択**
   - forestdali.bizを選択

3. **DNSを開く**
   - 左メニューから「DNS」をクリック

4. **レコードを追加**
   - 「Add record」をクリック
   - Resendが提供するDNSレコードを追加

### Namecheapの場合

1. **Namecheapにログイン**
   - https://www.namecheap.com にアクセス

2. **ドメインリストを開く**
   - 「Domain List」をクリック
   - forestdali.bizを選択

3. **Advanced DNSを開く**
   - 「Advanced DNS」タブをクリック

4. **レコードを追加**
   - 「Add New Record」をクリック
   - Resendが提供するDNSレコードを追加

### GoDaddyの場合

1. **GoDaddyにログイン**
   - https://www.godaddy.com にアクセス

2. **マイプロダクトを開く**
   - 「マイプロダクト」をクリック
   - forestdali.bizを選択

3. **DNSを開く**
   - 「DNS」をクリック

4. **レコードを追加**
   - 「追加」または「Add」をクリック
   - Resendが提供するDNSレコードを追加

## DNSレコードの追加手順（共通）

どのDNSプロバイダーでも、基本的な手順は同じです：

### 1. TXTレコード（DKIM）を追加

```
Type: TXT
Name: resend._domainkey
Content: p=MIGfMA0GCSqGSIb3DQEB...（Resendが表示している完全な値）
TTL: 3600（またはAuto）
```

**注意**: Nameフィールドには、サブドメイン部分のみを入力します。
- 例: `resend._domainkey`（`forestdali.biz`は自動的に追加される）

### 2. MXレコードを追加

```
Type: MX
Name: send
Content: feedback-smtp.ap-northeast-1.amazonses.com（完全な値）
TTL: 3600（またはAuto）
Priority: 10
```

### 3. TXTレコード（SPF）を追加

```
Type: TXT
Name: send
Content: v=spf1 include:amazonses.com ~all（完全な値）
TTL: 3600（またはAuto）
```

### 4. TXTレコード（DMARC）を追加（オプション）

```
Type: TXT
Name: _dmarc
Content: v=DMARC1; p=none;
TTL: 3600（またはAuto）
```

## 確認方法

DNSレコードを追加したら：

1. **DNSチェックツールで確認**
   - https://mxtoolbox.com にアクセス
   - 「DNS Lookup」で `resend._domainkey.forestdali.biz` を検索
   - レコードが正しく設定されているか確認

2. **Resendダッシュボードで確認**
   - Resendダッシュボードに戻る
   - forestdali.bizドメインのページを開く
   - DNSレコードのステータスを確認
   - すべてのレコードが「Verified」になるまで待つ

## よくある質問

### Q: Google Workspaceの管理画面で設定できないか？

A: いいえ。DNSレコードは、ドメインのDNSプロバイダー（ドメインレジストラ）で設定する必要があります。Google Workspaceの管理画面では設定できません。

### Q: どのDNSプロバイダーを使っているかわからない

A: 
1. WHOISで確認（https://whois.net）
2. ドメインを購入した場所を確認
3. メールで確認（ドメイン購入時のメールを確認）

### Q: DNSレコードを追加したが反映されない

A: 
- DNSの反映には時間がかかります（数分〜24時間）
- レコードが正しく設定されているか確認
- DNSチェックツールで確認

## 次のステップ

1. **forestdali.bizのDNSプロバイダーを特定**
   - ドメインを購入した場所を確認
   - またはWHOISで確認

2. **DNS管理画面にアクセス**
   - DNSプロバイダーにログイン
   - forestdali.bizのDNS設定を開く

3. **DNSレコードを追加**
   - Resendが提供するDNSレコードを追加

4. **反映を待つ**
   - 数分〜数時間待つ
   - Resendダッシュボードで検証状況を確認

## まとめ

DNSレコードは、**forestdali.bizドメインを管理しているDNSプロバイダー**で設定します。

- ❌ Google Workspaceの管理画面では設定できません
- ✅ ドメインレジストラ（Google Domains、Cloudflare、Namecheapなど）のDNS管理画面で設定します

forestdali.bizをどこで購入しましたか？それに応じて、具体的な設定手順を案内できます。

