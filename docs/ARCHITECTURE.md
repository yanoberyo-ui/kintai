# システムアーキテクチャ

## 概要

勤怠管理・タスク管理を統合したWebアプリケーション。Slack連携による通知・インタラクション機能を持つ。

## 技術スタック

| レイヤー | 技術 |
|---------|------|
| フロントエンド | React + Vite |
| スタイリング | Tailwind CSS |
| バックエンド | Supabase (PostgreSQL + Edge Functions) |
| 認証 | Supabase Auth |
| 通知 | Slack Webhook + Slack App |
| ホスティング | Netlify (フロント) / Supabase (バックエンド) |

## ディレクトリ構成

```
kintai-dev/
├── src/
│   ├── features/           # 機能別モジュール（バーティカルスライス）
│   │   ├── attendance/     # 出勤・退勤管理
│   │   │   ├── components/ # UIコンポーネント
│   │   │   └── utils/      # ビジネスロジック
│   │   ├── todo/           # タスク管理
│   │   ├── calendar/       # カレンダー・スケジュール
│   │   ├── ranking/        # ランキング機能
│   │   ├── pomodoro/       # ポモドーロタイマー
│   │   ├── reservations/   # 会議室予約
│   │   ├── announcements/  # お知らせ
│   │   ├── admin/          # 管理画面
│   │   ├── survey/         # 健康サーベイ
│   │   └── common/         # 共通コンポーネント
│   ├── utils/              # 共通ユーティリティ
│   │   ├── supabase.js     # Supabaseクライアント
│   │   ├── date.js         # 日付処理
│   │   ├── slack.js        # Slack通知
│   │   └── ...
│   ├── App.jsx             # ルートコンポーネント
│   └── main.jsx            # エントリーポイント
├── supabase/
│   ├── functions/          # Edge Functions
│   │   ├── check-incomplete-attendance/   # 退勤漏れチェック（自動補完）
│   │   ├── remind-incomplete-attendance/  # 退勤漏れリマインド通知
│   │   ├── slack-interaction/             # Slackボタン操作ハンドラ
│   │   ├── notify-slack/                  # Slack通知送信
│   │   ├── daily-profitability-report/    # 日次収益レポート
│   │   └── ...
│   └── migrations/         # DBマイグレーション
├── gas/                    # Google Apps Script（外部連携）
└── docs/                   # ドキュメント
```

## 主要機能

### 1. 出勤管理 (attendance)
- 出勤・退勤打刻
- リモート/出社の選択
- 休憩時間管理
- 勤務履歴表示

### 2. タスク管理 (todo)
- デイリータスク
- ウィークリータスク
- Google Calendar連携
- 進捗トラッキング

### 3. Slack連携
- 退勤漏れ通知（2段階）
  1. 10:00 リマインド通知（ボタン付き）
  2. 12:00 自動補完（23:59退勤として記録）
- インタラクティブなボタン操作

## データフロー

```
[ユーザー] → [React App] → [Supabase]
                              ↓
                         [PostgreSQL]
                              ↓
                      [Cron Job (pg_cron)]
                              ↓
                      [Edge Functions]
                              ↓
                         [Slack API]
```

## 環境変数

### フロントエンド (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

### Supabase Edge Functions
```
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SLACK_REMINDER_WEBHOOK_URL=https://hooks.slack.com/services/xxx
SLACK_BOT_TOKEN=xoxb-xxx
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx
```

## Cronジョブ

| スケジュール | 関数 | 説明 |
|-------------|------|------|
| 毎日 10:00 JST | remind-incomplete-attendance | 退勤漏れリマインド |
| 毎日 12:00 JST | check-incomplete-attendance | 退勤漏れ自動補完 |
| 毎日 09:00 JST | daily-profitability-report | 日次レポート |
