# セットアップガイド

## 前提条件

- Node.js 18+
- npm または pnpm
- Supabaseアカウント
- Slackワークスペース（管理者権限）

## 1. リポジトリのクローン

```bash
git clone <repository-url>
cd kintai-dev
npm install
```

## 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

## 3. ローカル開発

```bash
npm run dev
```

http://localhost:5173 でアクセス

## 4. Supabase設定

### 4.1 プロジェクト作成
1. https://supabase.com でプロジェクト作成
2. Project Settings → API からURLとキーを取得

### 4.2 マイグレーション実行
```bash
cd supabase
supabase link --project-ref your-project-ref
supabase db push
```

### 4.3 Edge Functions デプロイ
```bash
supabase functions deploy check-incomplete-attendance
supabase functions deploy remind-incomplete-attendance
supabase functions deploy slack-interaction
supabase functions deploy notify-slack
supabase functions deploy daily-profitability-report
```

### 4.4 Edge Functions 環境変数
Supabase Dashboard → Edge Functions → Secrets で設定:
- `SLACK_WEBHOOK_URL`
- `SLACK_REMINDER_WEBHOOK_URL`
- `SLACK_BOT_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## 5. Slack App設定

### 5.1 Slack App作成
1. https://api.slack.com/apps で新規App作成
2. OAuth & Permissions で以下のスコープを追加:
   - `chat:write`
   - `users:read`
   - `users:read.email`

### 5.2 Webhook URL取得
1. Incoming Webhooks を有効化
2. 通知先チャンネルを選択してWebhook URL取得

### 5.3 Interactivity設定
1. Interactivity & Shortcuts を有効化
2. Request URL に Edge Function の URL を設定:
   ```
   https://your-project.supabase.co/functions/v1/slack-interaction
   ```

## 6. デプロイ

### Netlify
```bash
npm run build
# dist/ フォルダをNetlifyにデプロイ
```

または Netlify CLI:
```bash
netlify deploy --prod
```

## トラブルシューティング

### ビルドエラー
```bash
rm -rf node_modules
npm install
npm run build
```

### Supabase接続エラー
- 環境変数が正しく設定されているか確認
- Supabase Dashboardでプロジェクトがアクティブか確認

### Slack通知が届かない
- Webhook URLが正しいか確認
- Edge Functionsのログを確認:
  ```bash
  supabase functions logs remind-incomplete-attendance
  ```
