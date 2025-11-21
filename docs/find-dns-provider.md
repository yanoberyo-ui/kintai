# DNSプロバイダーを確認する方法

forestdali.bizのDNSプロバイダーを確認して、DNSレコードを設定する場所を特定します。

## 方法1: WHOISで確認（最も簡単）

1. **WHOIS検索サイトにアクセス**
   - https://whois.net にアクセス
   - または https://whois.com にアクセス

2. **forestdali.bizを検索**
   - 検索ボックスに `forestdali.biz` を入力
   - 「Search」または「Lookup」をクリック

3. **ネームサーバーを確認**
   - 「Name Servers」または「DNS Servers」セクションを確認
   - 表示されたネームサーバーからDNSプロバイダーを特定

**ネームサーバーの例：**
- `ns1.google.com`, `ns2.google.com` → Google Domains
- `ns1.cloudflare.com`, `ns2.cloudflare.com` → Cloudflare
- `ns1.namecheap.com`, `ns2.namecheap.com` → Namecheap
- `ns1.godaddy.com`, `ns2.godaddy.com` → GoDaddy

## 方法2: Google Workspace管理コンソールから確認

1. **Google Workspace管理コンソールにアクセス**
   - https://admin.google.com にアクセス
   - 管理者アカウントでログイン

2. **ドメイン設定を開く**
   - 左メニューから「**アプリ**」→「**Google Workspace**」をクリック
   - 「**ドメイン**」をクリック
   - forestdali.bizを選択

3. **DNS設定を確認**
   - 「**DNS設定**」または「**DNSレコード**」をクリック
   - DNSプロバイダーやネームサーバーの情報が表示される場合があります

4. **ドメインの管理を確認**
   - 「**ドメインの管理**」リンクがある場合、そこからDNS設定にアクセスできる可能性があります

## 方法3: コマンドラインで確認

ターミナルで以下のコマンドを実行：

```bash
nslookup -type=NS forestdali.biz
```

または：

```bash
dig NS forestdali.biz
```

ネームサーバーが表示されます。

## 方法4: オンラインツールで確認

1. **MXToolboxで確認**
   - https://mxtoolbox.com にアクセス
   - 「DNS Lookup」を選択
   - `forestdali.biz` を入力
   - 「NS」レコードを確認

2. **DNS Checkerで確認**
   - https://dnschecker.org にアクセス
   - `forestdali.biz` を入力
   - ネームサーバーを確認

## よくあるDNSプロバイダーと設定方法

### Cloudflareの場合

1. **Cloudflareにログイン**
   - https://dash.cloudflare.com にアクセス

2. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizを選択

3. **DNSを開く**
   - 左メニューから「DNS」をクリック

4. **レコードを追加**
   - 「Add record」をクリック
   - Resendが提供するDNSレコードを追加

### Google Domainsの場合

1. **Google Domainsにログイン**
   - https://domains.google.com にアクセス
   - または、Google Workspace管理コンソールから「ドメインの管理」をクリック

2. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizを選択

3. **DNS設定を開く**
   - 「DNS」タブをクリック
   - 「カスタムリソースレコード」セクションを開く

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

## ネームサーバーがGoogle Workspaceの場合

ネームサーバーが `ns1.google.com` や `ns2.google.com` の場合：

1. **Google Workspace管理コンソールから確認**
   - 「アプリ」→「Google Workspace」→「ドメイン」
   - 「DNS設定」または「DNSレコード」を確認

2. **Google Domainsにアクセス**
   - https://domains.google.com にアクセス
   - forestdali.bizが表示されない場合、別のGoogleアカウントで管理されている可能性があります

3. **ドメインの購入場所を確認**
   - forestdali.bizを購入した場所を確認
   - そのレジストラのDNS管理画面で設定

## 次のステップ

1. **WHOISでネームサーバーを確認**
   - https://whois.net で `forestdali.biz` を検索
   - ネームサーバーを確認

2. **DNSプロバイダーを特定**
   - ネームサーバーからDNSプロバイダーを特定

3. **DNSプロバイダーにログイン**
   - 該当するDNSプロバイダーにログイン
   - forestdali.bizのDNS設定を開く

4. **DNSレコードを追加**
   - Resendが提供するDNSレコードを追加

## まとめ

Squarespaceにアクセスできない場合：

1. ✅ **WHOISでネームサーバーを確認**
2. ✅ **DNSプロバイダーを特定**
3. ✅ **該当するDNSプロバイダーでDNSレコードを設定**

まずはWHOISでネームサーバーを確認して、DNSプロバイダーを特定しましょう！

