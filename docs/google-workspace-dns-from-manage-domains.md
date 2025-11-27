# Google Workspace「Manage domains」画面からDNSレコードを設定する方法

「Manage domains」画面が表示されている場合のDNSレコード設定手順を説明します。

## 現在の画面

「Manage domains」画面には、forestdali.bizが「Primary Domain」として表示されています。

## DNSレコードを設定する方法

### 方法1: forestdali.bizの行をクリック（推奨）

1. **forestdali.bizの行をクリック**
   - テーブルの中の「forestdali.biz」の行全体をクリック
   - または「forestdali.biz」のテキストをクリック
   - これでforestdali.bizの詳細設定画面に移動します

2. **DNS設定を探す**
   - 詳細設定画面で「DNS設定」または「DNSレコード」セクションを探す
   - タブやメニューから「DNS」を選択

### 方法2: Google Domainsに直接アクセス（最も簡単）

Google Workspace管理コンソールから直接DNSレコードを設定できない場合、Google Domainsに直接アクセスする方が簡単です。

1. **Google Domainsにアクセス**
   ```
   https://domains.google.com
   ```

2. **forestdali.bizを選択**
   - ドメインリストからforestdali.bizをクリック

3. **DNS設定を開く**
   - 「DNS」タブをクリック
   - 「カスタムリソースレコード」セクションを開く

4. **ResendのDNSレコードを追加**
   - Resendダッシュボードに表示されているDNSレコードを追加

### 方法3: 「Change redirect」からアクセス

1. **「Change redirect」をクリック**
   - forestdali.bizの行の「Actions」列にある「Change redirect」をクリック
   - これでDNS設定画面に移動する可能性があります

## 推奨される手順

### ステップ1: Google Domainsにアクセス（最も確実）

1. **新しいタブを開く**
   - ブラウザで新しいタブを開く

2. **Google Domainsにアクセス**
   ```
   https://domains.google.com
   ```

3. **Googleアカウントでログイン**
   - Google Workspaceと同じアカウントでログイン

4. **forestdali.bizを選択**
   - ホーム画面の「My domains」セクションからforestdali.bizをクリック

5. **DNS設定を開く**
   - 「DNS」タブをクリック
   - ページをスクロールして「カスタムリソースレコード」セクションを見つける

### ステップ2: ResendのDNSレコードを追加

Google DomainsのDNS設定画面で、以下のレコードを追加：

#### 1. TXTレコード（DKIM）

「カスタムリソースレコードを追加」をクリック：

```
ホスト名: resend._domainkey
タイプ: TXT
TTL: 3600
データ: p=MIGfMA0GCSqGSIb3DQEB...（Resendが表示している完全な値をコピー）
```

#### 2. MXレコード

```
ホスト名: send
タイプ: MX
TTL: 3600
優先度: 10
データ: feedback-smtp.ap-northeast-1.amazonses.com（完全な値）
```

#### 3. TXTレコード（SPF）

```
ホスト名: send
タイプ: TXT
TTL: 3600
データ: v=spf1 include:amazonses.com ~all（完全な値）
```

#### 4. TXTレコード（DMARC）（オプション）

```
ホスト名: _dmarc
タイプ: TXT
TTL: 3600
データ: v=DMARC1; p=none;
```

### ステップ3: 保存して確認

1. **すべてのレコードを追加したら保存**
   - 各レコードを追加した後、「追加」または「保存」をクリック

2. **DNSの反映を待つ**
   - DNSレコードの反映には数分〜数時間かかります
   - 通常は10分〜1時間程度

3. **Resendダッシュボードで確認**
   - Resendダッシュボードに戻る
   - forestdali.bizドメインのページを開く
   - DNSレコードのステータスを確認
   - すべてのレコードが「Verified」になるまで待つ

## まとめ

「Manage domains」画面からDNSレコードを設定するには：

1. ✅ **Google Domainsに直接アクセス（推奨）**: https://domains.google.com
2. ✅ **forestdali.bizを選択**: ドメインリストからforestdali.bizをクリック
3. ✅ **DNS設定を開く**: 「DNS」タブをクリック
4. ✅ **ResendのDNSレコードを追加**: カスタムリソースレコードセクションで追加

**最も簡単な方法は、Google Domains（https://domains.google.com）に直接アクセスすることです。**

Google Domainsにアクセスして、forestdali.bizのDNS設定を開いてください。

