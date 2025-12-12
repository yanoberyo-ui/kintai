# 今週のタスク & 日毎カレンダー機能 設計書

## 概要

ホーム画面に「今週のタスク」セクションを追加し、新規ページとして「日毎カレンダー」を作成する。

---

## 1. 今週のタスク（Weekly Tasks）

### 概要
- ホーム画面に新しいセクションとして追加
- 期限付きだが「今日着手しない」タスクを管理
- 期限は**日付＋時間**で指定可能

### UI設計
```
┌─────────────────────────────────────────┐
│ 📅 今週のタスク                          │
├─────────────────────────────────────────┤
│ □ タスク名1          期限: 12/13 14:00   │
│ □ タスク名2          期限: 12/15 10:00   │
│ □ タスク名3          期限: 12/15 18:00   │
│                                         │
│ [+ タスクを追加]                         │
└─────────────────────────────────────────┘
```

### データモデル（weekly_tasks テーブル）
```sql
CREATE TABLE weekly_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,  -- 期限（日付＋時間）
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLSポリシー
ALTER TABLE weekly_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own weekly tasks"
  ON weekly_tasks FOR ALL
  USING (auth.uid() = user_id);
```

### 機能
- タスク追加（タイトル＋期限）
- タスク完了/未完了の切り替え
- タスク削除
- 期限でソート（近い順）
- 期限切れタスクのハイライト表示

---

## 2. 日毎カレンダー（Daily Calendar Page）

### 概要
- 新規ページとして作成
- 自分と複数のメンバーの日毎スケジュールを横並びで表示
- 時間軸は縦（1時間単位）
- メンバーを追加/削除できる

### UI設計
```
┌──────────────────────────────────────────────────────────────────┐
│ 日毎カレンダー        📅 2025/12/11 (木)   [< 前日] [今日] [翌日 >] │
├──────────────────────────────────────────────────────────────────┤
│ [+ メンバー追加]                                                  │
├──────┬────────────┬────────────┬────────────┬────────────────────┤
│ 時間 │   自分     │  田中さん  │  佐藤さん  │      ...           │
├──────┼────────────┼────────────┼────────────┼────────────────────┤
│ 9:00 │            │ ミーティング│           │                    │
│ 10:00│ 資料作成   │     ↓      │ 開発作業  │                    │
│ 11:00│    ↓       │            │    ↓      │                    │
│ 12:00│ 昼休み     │ 昼休み     │ 昼休み    │                    │
│ 13:00│ レビュー   │            │           │                    │
│ 14:00│            │ 面談       │           │                    │
│  ...  │            │            │           │                    │
└──────┴────────────┴────────────┴────────────┴────────────────────┘
```

### データモデル（daily_events テーブル）
```sql
CREATE TABLE daily_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  title TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  date DATE NOT NULL,
  color TEXT DEFAULT '#6366f1',  -- 表示色
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLSポリシー（他メンバーの予定も読み取り可能）
ALTER TABLE daily_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own events"
  ON daily_events FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view all events"
  ON daily_events FOR SELECT
  USING (true);
```

### 機能
- 日付の切り替え（前日/今日/翌日）
- メンバー追加（ユーザー選択）
- メンバー削除
- 自分のイベント追加/編集/削除
- 時間軸クリックでイベント追加
- イベントのドラッグ&ドロップで時間変更

---

## 3. 実装計画

### Phase 1: 今週のタスク
1. `weekly_tasks` テーブル作成（Supabase）
2. `WeeklyTasksSection.jsx` コンポーネント作成
3. ホーム画面（App.jsx）に追加

### Phase 2: 日毎カレンダー
1. `daily_events` テーブル作成（Supabase）
2. `DailyCalendarPage.jsx` コンポーネント作成
3. サイドバーにナビゲーション追加
4. メンバー選択機能
5. イベント追加/編集UI

---

## 4. 技術スタック

- **フロントエンド**: React + Tailwind CSS
- **バックエンド**: Supabase
- **状態管理**: useState + useEffect
- **日付処理**: date-fns（既存利用）

---

## 5. 作業工数見積もり

| 機能 | 工数 |
|------|------|
| 今週のタスク（DB + UI） | 2-3時間 |
| 日毎カレンダー（DB + UI） | 4-6時間 |
| テスト・調整 | 1-2時間 |
| **合計** | **7-11時間** |
