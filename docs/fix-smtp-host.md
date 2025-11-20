# SMTP設定の修正方法

## 問題点

現在の設定で、**Hostフィールドが間違っています**。

### 現在の設定（間違い）
```
Host: fd-app-gamma.vercel.app  ← これはVercelのデプロイURLです
```

### 正しい設定
```
Host: smtp.gmail.com  ← GmailのSMTPサーバー
```

## 修正手順

1. **Supabaseダッシュボードを開く**
   - 「Authentication」→「Settings」→「SMTP Settings」

2. **Hostフィールドを修正**
   - 現在: `fd-app-gamma.vercel.app`
   - 変更後: `smtp.gmail.com`

3. **その他の設定を確認**
   - Port: `587` ✅（正しい）
   - Username: `yamamotoikki@forestdali.biz` ✅（正しい）
   - Password: `kfplzymbpqzvtpx` ✅（正しい、スペースなし）
   - Sender email: `yamamotoikki@forestdali.biz` ✅（正しい）
   - Sender name: `FD Hub` ✅（正しい）

4. **保存**
   - 「Save」をクリック

5. **テスト**
   - 「Authentication」→「Email Templates」→「Reset Password」
   - 「Send test email」でテスト

## 正しい設定の全体像

```
Sender details:
- Sender email: yamamotoikki@forestdali.biz
- Sender name: FD Hub

SMTP provider settings:
- Host: smtp.gmail.com  ← ここを修正！
- Port: 587
- Username: yamamotoikki@forestdali.biz
- Password: kfplzymbpqzvtpx
- Minimum interval per user: 60
```

## なぜ504エラーが発生していたか

`fd-app-gamma.vercel.app` はVercelのデプロイURLであり、SMTPサーバーではありません。SupabaseがこのURLにSMTP接続を試みたため、タイムアウト（504エラー）が発生していました。

Gmail SMTPを使用する場合は、必ず `smtp.gmail.com` を指定する必要があります。

