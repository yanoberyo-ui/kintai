# 認証キー・トークンのローテーション手順書

## 1. Google Service Account キー

### ローテーション手順
1. Google Cloud Console > IAM > サービスアカウント にアクセス
2. 該当サービスアカウントの「キー」タブを開く
3. 「鍵を追加」>「新しい鍵を作成」> JSON形式
4. 新しいキーをダウンロード
5. Supabase Dashboard > Edge Functions > Secrets で `GOOGLE_SERVICE_ACCOUNT_KEY` を更新
6. 動作確認後、古いキーを Google Cloud Console で無効化・削除

### 推奨頻度
- 90日ごと

### 影響範囲
- `get-unit-rankings` Edge Function
- `import-revenue` Edge Function
- `daily-profitability-report` Edge Function
- GAS（Google Apps Script）のスプレッドシート出力

---

## 2. Slack Bot Token

### ローテーション手順
1. Slack API (api.slack.com) > Your Apps > 対象アプリ
2. 「OAuth & Permissions」ページ
3. 必要に応じてトークンを再生成
4. Supabase Dashboard > Edge Functions > Secrets で `SLACK_BOT_TOKEN` を更新
5. `SLACK_WEBHOOK_URL` も同様に確認・更新

### 推奨頻度
- 180日ごと、またはメンバー変更時

### 影響範囲
- `slack-command` Edge Function
- `slack-interaction` Edge Function
- `notify-slack` Edge Function

---

## 3. Supabase Service Role Key

### 注意
- Service Role Key は Supabase プロジェクト設定から再生成可能
- 再生成するとすべての Edge Functions が影響を受ける
- 本番環境での再生成は計画的に実施すること

### ローテーション手順
1. Supabase Dashboard > Settings > API
2. Service Role Key を再生成
3. すべての Edge Functions の `SUPABASE_SERVICE_ROLE_KEY` を更新

---

## 4. OpenAI API Key

### ローテーション手順
1. OpenAI Platform > API Keys にアクセス
2. 新しいキーを作成
3. Vercel Dashboard > Settings > Environment Variables で `OPENAI_API_KEY` を更新
4. 再デプロイ
5. 古いキーを削除

### 推奨頻度
- 90日ごと

### 影響範囲
- `/api/generate-feedback.js`（退勤時AIフィードバック）
