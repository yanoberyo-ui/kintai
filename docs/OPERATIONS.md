# 運用手順書

## 日常運用

### ログ確認

#### Edge Functions ログ
```bash
# リアルタイム
supabase functions logs <function-name> --tail

# 例: 退勤漏れチェック
supabase functions logs check-incomplete-attendance --tail
supabase functions logs remind-incomplete-attendance --tail
```

#### Supabase Dashboard
1. https://supabase.com/dashboard でログイン
2. プロジェクト選択 → Logs → Edge Functions

### Cronジョブ確認

```sql
-- 登録されているCronジョブ一覧
SELECT * FROM cron.job;

-- 実行履歴
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

## 障害対応

### Slack通知が届かない場合

1. **Edge Functionsログ確認**
   ```bash
   supabase functions logs remind-incomplete-attendance
   ```

2. **Webhook URL確認**
   - Supabase Dashboard → Edge Functions → Secrets
   - `SLACK_WEBHOOK_URL` が正しいか確認

3. **手動実行テスト**
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/remind-incomplete-attendance
   ```

### Cronジョブが動かない場合

1. **pg_cronの状態確認**
   ```sql
   SELECT * FROM cron.job WHERE jobname LIKE '%attendance%';
   ```

2. **Cronジョブ再登録**
   ```sql
   -- 削除
   SELECT cron.unschedule('remind-incomplete-attendance');

   -- 再登録（JST 10:00 = UTC 01:00）
   SELECT cron.schedule(
     'remind-incomplete-attendance',
     '0 1 * * *',
     $$SELECT net.http_post(
       url := 'https://your-project.supabase.co/functions/v1/remind-incomplete-attendance',
       headers := '{"Authorization": "Bearer your-anon-key"}'::jsonb
     )$$
   );
   ```

### データベース接続エラー

1. **Supabase Dashboardでステータス確認**
2. **接続プール確認**
   - Settings → Database → Connection Pooling

## 定期メンテナンス

### 月次

1. **ログ確認**
   - エラーログの傾向確認
   - パフォーマンス問題の兆候確認

2. **ストレージ確認**
   - Supabase Dashboard → Storage
   - 不要ファイルの削除

### 年次

1. **依存パッケージ更新**
   ```bash
   npm update
   npm audit fix
   ```

2. **Supabaseプラン確認**
   - 使用量がプラン上限に近づいていないか

## 連絡先

- Supabase障害: https://status.supabase.com
- Slack API障害: https://status.slack.com
