# FDGroup勤怠管理システム - セットアップガイド

本番環境へのデプロイ手順を説明します。

## 📋 事前準備

以下が揃っていることを確認してください：

- ✅ Supabaseプロジェクト
  - URL: `https://thwfendgywwxbdjofbdt.supabase.co`
  - Anon Key: 設定済み
- ✅ Node.js (v18以上)
- ✅ Googleアカウント（スプレッドシート出力用）
- ✅ Slackワークスペース（通知用、オプション）

---

## 🗄️ ステップ1: データベースのセットアップ

### 1.1 Supabase管理画面にアクセス

1. https://supabase.com にアクセス
2. プロジェクトを選択
3. 左メニューから `SQL Editor` をクリック

### 1.2 マイグレーションの実行

1. `New query` をクリック
2. `supabase/migrations/001_initial_schema.sql` の内容をコピー
3. エディタに貼り付けて `Run` をクリック
4. 成功メッセージを確認

### 1.3 認証の設定

1. 左メニューから `Authentication` をクリック
2. `Users` タブで `Add user` → `Create new user` をクリック
3. テストユーザーを作成:
   - Email: `yamada@fdgroup.com`
   - Password: `password123`
   - Auto Confirm User: ON

> **重要**: テストユーザーのemailは、データベースに登録されているユーザー情報と一致させる必要があります

### 1.4 ユーザーとAuth Userの紐付け

データベースに挿入されたテストユーザーの `id` を、作成したAuth Userの `id` に合わせる必要があります：

```sql
-- 1. Auth Userのidを確認
SELECT id, email FROM auth.users WHERE email = 'yamada@fdgroup.com';

-- 2. usersテーブルのidを更新
UPDATE users
SET id = '【Auth UserのID】'
WHERE email = 'yamada@fdgroup.com';
```

---

## 💻 ステップ2: ローカル開発環境のセットアップ

### 2.1 依存パッケージのインストール

```bash
cd kintai-dev
npm install
```

### 2.2 環境変数の確認

`.env` ファイルが以下の内容になっているか確認:

```
VITE_SUPABASE_URL=https://thwfendgywwxbdjofbdt.supabase.co
VITE_SUPABASE_ANON_KEY=【あなたのAnonKey】
```

### 2.3 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:3000` にアクセスして動作確認

---

## 🔔 ステップ3: Slack通知の設定（オプション）

### 3.1 Slack Incoming Webhookの作成

1. https://api.slack.com/apps にアクセス
2. `Create New App` → `From scratch` を選択
3. App名を「FDGroup勤怠通知」、ワークスペースを選択
4. `Incoming Webhooks` を有効化
5. `Add New Webhook to Workspace` をクリック
6. 通知先チャンネルを選択
7. Webhook URLをコピー

### 3.2 Edge Functionのデプロイ

#### Supabase CLIのインストール

```bash
npm install -g supabase
```

#### Supabaseにログイン

```bash
supabase login
```

#### Edge Functionをデプロイ

```bash
supabase functions deploy notify-slack --project-ref thwfendgywwxbdjofbdt
```

#### Secretsの設定

```bash
supabase secrets set SLACK_WEBHOOK_URL="【あなたのWebhook URL】" --project-ref thwfendgywwxbdjofbdt
```

### 3.3 フロントエンドでSlack通知を有効化

`src/app.js` を編集して、打刻時にSlack通知を送信:

```javascript
// handleClockIn関数に追加
import { sendSlackNotification } from './utils/slack.js';

async function handleClockIn() {
  try {
    showLoading(clockInBtn, '打刻中...');
    currentAttendance = await clockIn(currentUser.id);

    // Slack通知を送信
    await sendSlackNotification('clock_in', currentUser, currentAttendance);

    updateAttendanceUI();
    showSuccess('出勤しました');
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading(clockInBtn, '🌅 出勤する');
  }
}

// handleClockOut関数にも同様に追加
async function handleClockOut() {
  if (!confirm('退勤しますか?')) return;

  try {
    showLoading(clockOutBtn, '打刻中...');
    currentAttendance = await clockOut(currentUser.id);

    // Slack通知を送信
    await sendSlackNotification('clock_out', currentUser, currentAttendance);

    updateAttendanceUI();
    showSuccess('退勤しました');
  } catch (error) {
    showError(error.message);
  } finally {
    hideLoading(clockOutBtn, '🌆 退勤する');
  }
}
```

---

## 📊 ステップ4: スプレッドシート自動出力の設定

詳細は `gas/README.md` を参照してください。

### 概要

1. Googleスプレッドシートを新規作成
2. Apps Scriptプロジェクトを作成
3. `gas/auto-export.js` をコピー
4. スクリプトプロパティを設定
5. 毎日11:00のトリガーを設定

---

## 🚀 ステップ5: 本番環境へのデプロイ

### 5.1 ビルド

```bash
npm run build
```

### 5.2 デプロイ先の選択

#### Option A: Vercel

```bash
# Vercel CLIのインストール
npm install -g vercel

# デプロイ
vercel

# 環境変数の設定
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

#### Option B: Netlify

```bash
# Netlify CLIのインストール
npm install -g netlify-cli

# ログイン
netlify login

# デプロイ
netlify deploy --prod

# 環境変数の設定
netlify env:set VITE_SUPABASE_URL "【URL】"
netlify env:set VITE_SUPABASE_ANON_KEY "【Key】"
```

#### Option C: Supabase Hosting

```bash
# Supabaseにデプロイ
supabase deploy
```

---

## ✅ ステップ6: 動作確認

### 6.1 基本機能の確認

- [ ] ログインできる
- [ ] 出勤打刻ができる
- [ ] 退勤打刻ができる
- [ ] 休憩開始/終了ができる
- [ ] TODOの追加/編集/削除ができる
- [ ] 進捗率が正しく計算される
- [ ] 月次サマリーが表示される

### 6.2 Slack通知の確認

- [ ] 出勤時にSlackに通知が届く
- [ ] 退勤時にSlackに通知が届く
- [ ] 通知内容が正しい

### 6.3 スプレッドシート出力の確認

- [ ] 毎日11:00に自動実行される
- [ ] 前日のデータが出力される
- [ ] ユーザーごとにシートが分かれている
- [ ] 月次集計が正しい

---

## 🔧 トラブルシューティング

### ログインできない

**原因**: Auth UserとDBのユーザーが紐付いていない

**解決策**:
```sql
-- Auth Userのidを確認
SELECT id, email FROM auth.users;

-- DBのusersテーブルを更新
UPDATE users SET id = '【Auth UserのID】' WHERE email = '【メールアドレス】';
```

### データベースエラーが出る

**原因**: マイグレーションが正しく実行されていない

**解決策**:
1. Supabase管理画面で `SQL Editor` を開く
2. テーブルが作成されているか確認
3. マイグレーションを再実行

### Slack通知が届かない

**原因**: Webhook URLまたはEdge Functionの設定ミス

**解決策**:
1. Webhook URLが正しいか確認
2. Edge Functionがデプロイされているか確認
3. Secretsが設定されているか確認

---

## 📚 参考資料

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Viteドキュメント](https://vitejs.dev/)
- [Tailwind CSSドキュメント](https://tailwindcss.com/)
- [Slack Webhook API](https://api.slack.com/messaging/webhooks)
- [Google Apps Script](https://developers.google.com/apps-script)

---

## 🎉 完了

セットアップが完了しました！

**次のステップ:**

1. 本番ユーザーを登録
2. 社員にログイン情報を配布
3. 12月1日から運用開始

**開発スケジュール:**
- ✅ 2025年11月11日: 開発開始
- 🎯 2025年11月20日: MVP完成目標
- 🚀 2025年12月1日: 本番稼働

お疲れ様でした！
