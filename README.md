# FDGroup 勤怠管理システム

1分単位の正確な時間計測を実現する勤怠管理Webアプリケーション

## 機能

- 出勤・退勤打刻（1分単位）
- 休憩時間管理（1時間上限）
- TODOリスト管理
- Slack通知連携
- スプレッドシート自動出力

## 技術スタック

- **フロントエンド**: HTML5, Tailwind CSS, Vanilla JavaScript
- **バックエンド**: Supabase (PostgreSQL + Auth + Realtime)
- **連携**: Slack Webhook, Google Apps Script

## セットアップ

### 1. 依存パッケージのインストール

```bash
npm install
```

### 2. 環境変数の設定

`.env`ファイルを作成し、Supabaseの認証情報を設定:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. データベースのマイグレーション

Supabase管理画面のSQL Editorで `supabase/migrations/001_initial_schema.sql` を実行

### 4. 開発サーバーの起動

```bash
npm run dev
```

## プロジェクト構造

```
kintai-dev/
├── public/           # 静的ファイル・HTML
├── src/
│   ├── components/   # UIコンポーネント
│   ├── utils/        # ユーティリティ関数
│   └── styles/       # CSSファイル
├── supabase/
│   ├── migrations/   # DBマイグレーション
│   └── functions/    # Edge Functions
└── requirement.md    # 要件定義書
```

## 開発スケジュール

- 開発期間: 2025年11月11日 〜 11月20日
- 本番稼働: 2025年12月1日
