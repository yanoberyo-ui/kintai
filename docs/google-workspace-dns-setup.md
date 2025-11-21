# Google WorkspaceでDNSレコードを設定する方法

Google Workspaceでforestdali.bizを管理している場合のDNSレコード設定手順を説明します。

## Google WorkspaceでのDNS設定方法

Google WorkspaceでDNSレコードを設定するには、2つの方法があります：

### 方法1: Google Domains / Squarespace Domains（推奨）

forestdali.bizがGoogle Domainsで管理されている場合：

1. **Google Domainsにアクセス**
   - https://domains.google.com にアクセス
   - または、Google Workspace管理コンソールから「ドメイン」→「ドメインの管理」をクリック

2. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizを選択

3. **DNS設定を開く**
   - 「DNS」または「DNS設定」をクリック
   - 「カスタムリソースレコード」セクションを開く

4. **DNSレコードを追加**
   - 「カスタムリソースレコードを追加」をクリック
   - Resendが提供するDNSレコードを追加

### 方法2: Google Workspace管理コンソールから

Google Workspace管理コンソールから直接DNSレコードを設定する場合：

1. **Google Workspace管理コンソールにアクセス**
   - https://admin.google.com にアクセス
   - 管理者アカウントでログイン

2. **ドメイン設定を開く**
   - 左メニューから「**アプリ**」→「**Google Workspace**」をクリック
   - 「**ドメイン**」をクリック
   - forestdali.bizを選択

3. **DNS設定を開く**
   - 「**DNS設定**」または「**DNSレコード**」をクリック
   - カスタムDNSレコードを追加できる場合は、そこから設定

**注意**: Google Workspace管理コンソールから直接DNSレコードを設定できない場合があります。その場合は、Google Domains（Squarespace Domains）で設定する必要があります。

## ResendのDNSレコードを追加する手順

### ステップ1: Google Domainsにアクセス

1. **Google Domainsにログイン**
   - https://domains.google.com にアクセス
   - Googleアカウントでログイン

2. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizを選択

### ステップ2: DNS設定を開く

1. **「DNS」タブをクリック**
   - 左メニューまたは上部タブから「DNS」を選択

2. **「カスタムリソースレコード」セクションを開く**
   - ページをスクロールして「カスタムリソースレコード」セクションを見つける

### ステップ3: DNSレコードを追加

Resendダッシュボードに表示されているDNSレコードを追加します。

#### 1. TXTレコード（DKIM）を追加

「カスタムリソースレコードを追加」をクリック：

```
ホスト名: resend._domainkey
タイプ: TXT
TTL: 3600
データ: p=MIGfMA0GCSqGSIb3DQEB...（Resendが表示している完全な値をコピー）
```

「追加」をクリック

#### 2. MXレコードを追加

「カスタムリソースレコードを追加」をクリック：

```
ホスト名: send
タイプ: MX
TTL: 3600
優先度: 10
データ: feedback-smtp.ap-northeast-1.amazonses.com（完全な値）
```

「追加」をクリック

#### 3. TXTレコード（SPF）を追加

「カスタムリソースレコードを追加」をクリック：

```
ホスト名: send
タイプ: TXT
TTL: 3600
データ: v=spf1 include:amazonses.com ~all（完全な値）
```

「追加」をクリック

#### 4. TXTレコード（DMARC）を追加（オプション）

「カスタムリソースレコードを追加」をクリック：

```
ホスト名: _dmarc
タイプ: TXT
TTL: 3600
データ: v=DMARC1; p=none;
```

「追加」をクリック

### ステップ4: 保存と確認

1. **すべてのレコードを追加したら保存**
   - 各レコードを追加した後、「保存」または「追加」をクリック

2. **DNSの反映を待つ**
   - DNSレコードの反映には数分〜数時間かかります
   - 通常は10分〜1時間程度

3. **Resendダッシュボードで確認**
   - Resendダッシュボードに戻る
   - forestdali.bizドメインのページを開く
   - DNSレコードのステータスを確認
   - すべてのレコードが「Verified」になるまで待つ

## Google Domainsが見つからない場合

Google DomainsがSquarespaceに移行された場合：

1. **Squarespace Domainsにアクセス**
   - https://domains.squarespace.com にアクセス
   - Googleアカウントでログイン

2. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizを選択

3. **DNS設定を開く**
   - 「DNS」または「DNS設定」をクリック
   - カスタムレコードを追加

## トラブルシューティング

### Google Domainsにアクセスできない場合

1. **Google Workspace管理コンソールから確認**
   - 「アプリ」→「Google Workspace」→「ドメイン」
   - 「ドメインの管理」リンクをクリック

2. **ドメインレジストラを確認**
   - WHOISで確認（https://whois.net）
   - forestdali.bizのネームサーバーを確認

### DNSレコードが反映されない場合

1. **レコードが正しく追加されているか確認**
   - Google DomainsのDNS設定画面で確認
   - タイポがないか確認

2. **DNSの反映を待つ**
   - DNSの反映には時間がかかります
   - 数時間待ってから再度確認

3. **DNSチェックツールで確認**
   - https://mxtoolbox.com にアクセス
   - 「DNS Lookup」で `resend._domainkey.forestdali.biz` を検索
   - レコードが正しく設定されているか確認

## チェックリスト

- [ ] Google Domains（またはSquarespace Domains）にアクセス
- [ ] forestdali.bizを選択
- [ ] DNS設定を開く
- [ ] TXTレコード（DKIM）を追加: `resend._domainkey`
- [ ] MXレコードを追加: `send` (Priority: 10)
- [ ] TXTレコード（SPF）を追加: `send`
- [ ] TXTレコード（DMARC）を追加: `_dmarc`（オプション）
- [ ] すべてのレコードを保存
- [ ] DNSの反映を待つ（数分〜数時間）
- [ ] Resendダッシュボードで検証状況を確認

## まとめ

Google Workspaceでforestdali.bizを管理している場合：

1. **Google Domains（またはSquarespace Domains）にアクセス**
2. **forestdali.bizのDNS設定を開く**
3. **Resendが提供するDNSレコードを追加**
4. **DNSの反映を待つ**
5. **Resendダッシュボードで検証状況を確認**

DNSレコードの設定が完了すると、forestdali.bizドメインからメールを送信できるようになります！

