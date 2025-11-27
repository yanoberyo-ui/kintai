# Google Workspace管理コンソールでDNSレコードを設定する方法

Google Workspaceでforestdali.bizを管理している場合、Google Workspace管理コンソールから直接DNSレコードを設定できます。

## Google Workspace管理コンソールでの設定手順

### ステップ1: Google Workspace管理コンソールにアクセス

1. **Google Workspace管理コンソールにログイン**
   - https://admin.google.com にアクセス
   - 管理者アカウントでログイン

2. **アプリを開く**
   - 左メニューから「**アプリ**」をクリック
   - 「**Google Workspace**」をクリック

### ステップ2: ドメイン設定を開く

1. **「ドメイン」をクリック**
   - Google Workspaceのメニューから「**ドメイン**」を選択

2. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizを選択

3. **DNS設定を開く**
   - 「**DNS設定**」または「**DNSレコード**」をクリック
   - または「**ドメインの管理**」をクリックして、DNS設定画面に移動

### ステップ3: DNSレコードを追加

Google Workspace管理コンソールでDNSレコードを追加できる場合：

#### 方法A: カスタムDNSレコードを追加

1. **「カスタムDNSレコード」または「DNSレコードを追加」をクリック**

2. **TXTレコード（DKIM）を追加**
   ```
   タイプ: TXT
   ホスト名: resend._domainkey
   値: p=MIGfMA0GCSqGSIb3DQEB...（Resendが表示している完全な値をコピー）
   TTL: 3600
   ```

3. **MXレコードを追加**
   ```
   タイプ: MX
   ホスト名: send
   値: feedback-smtp.ap-northeast-1.amazonses.com（完全な値）
   優先度: 10
   TTL: 3600
   ```

4. **TXTレコード（SPF）を追加**
   ```
   タイプ: TXT
   ホスト名: send
   値: v=spf1 include:amazonses.com ~all（完全な値）
   TTL: 3600
   ```

5. **TXTレコード（DMARC）を追加（オプション）**
   ```
   タイプ: TXT
   ホスト名: _dmarc
   値: v=DMARC1; p=none;
   TTL: 3600
   ```

#### 方法B: ドメインの管理から設定

1. **「ドメインの管理」をクリック**
   - これにより、Google DomainsまたはドメインレジストラのDNS設定画面に移動する可能性があります

2. **DNS設定画面でレコードを追加**
   - 表示されたDNS設定画面で、Resendが提供するDNSレコードを追加

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

## Google Workspace管理コンソールでDNSレコードが設定できない場合

Google Workspace管理コンソールから直接DNSレコードを設定できない場合：

### オプション1: ドメインの管理から設定

1. **「ドメインの管理」リンクをクリック**
   - これにより、ドメインレジストラのDNS設定画面に移動

2. **DNSレコードを追加**
   - 表示されたDNS設定画面で、Resendが提供するDNSレコードを追加

### オプション2: ネームサーバーを確認

1. **Google Workspace管理コンソールでネームサーバーを確認**
   - 「ドメイン」→「DNS設定」でネームサーバーを確認

2. **ネームサーバーに応じてDNSプロバイダーを特定**
   - ネームサーバーがXserverの場合 → Xserverで設定
   - ネームサーバーがGoogleの場合 → Google Domainsで設定
   - その他の場合 → 該当するDNSプロバイダーで設定

## トラブルシューティング

### DNS設定画面が見つからない場合

1. **「アプリ」→「Google Workspace」→「ドメイン」を確認**
   - ドメイン設定画面を開く

2. **「ドメインの管理」リンクを確認**
   - このリンクからDNS設定画面にアクセスできる可能性があります

3. **Google Workspaceサポートに問い合わせ**
   - DNSレコードの設定方法について問い合わせ

### DNSレコードが反映されない場合

1. **レコードが正しく追加されているか確認**
   - Google Workspace管理コンソールのDNS設定画面で確認
   - タイポがないか確認

2. **DNSの反映を待つ**
   - DNSの反映には時間がかかります
   - 数時間待ってから再度確認

3. **DNSチェックツールで確認**
   - https://mxtoolbox.com にアクセス
   - 「DNS Lookup」で `resend._domainkey.forestdali.biz` を検索
   - レコードが正しく設定されているか確認

## チェックリスト

- [ ] Google Workspace管理コンソールにログイン
- [ ] 「アプリ」→「Google Workspace」→「ドメイン」を開く
- [ ] forestdali.bizを選択
- [ ] 「DNS設定」または「ドメインの管理」を開く
- [ ] TXTレコード（DKIM）を追加: `resend._domainkey`
- [ ] MXレコードを追加: `send` (Priority: 10)
- [ ] TXTレコード（SPF）を追加: `send`
- [ ] TXTレコード（DMARC）を追加: `_dmarc`（オプション）
- [ ] すべてのレコードを保存
- [ ] DNSの反映を待つ（数分〜数時間）
- [ ] Resendダッシュボードで検証状況を確認

## まとめ

Google Workspaceでforestdali.bizを管理している場合：

1. ✅ **Google Workspace管理コンソールにアクセス**
2. ✅ **「アプリ」→「Google Workspace」→「ドメイン」を開く**
3. ✅ **forestdali.bizを選択**
4. ✅ **「DNS設定」または「ドメインの管理」を開く**
5. ✅ **Resendが提供するDNSレコードを追加**
6. ✅ **保存してDNSの反映を待つ**
7. ✅ **Resendダッシュボードで検証状況を確認**

Google Workspace管理コンソールからDNSレコードを設定できない場合は、「ドメインの管理」リンクからDNS設定画面にアクセスしてみてください。

