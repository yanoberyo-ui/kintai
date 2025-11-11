# FDGroup 勤怠管理システム 要件定義書

**作成日**: 2025年11月11日  
**最終更新**: 2025年11月11日  
**バージョン**: 1.0

---

## 目次

1. [プロジェクト概要](#1-プロジェクト概要)
2. [機能要件](#2-機能要件)
3. [非機能要件](#3-非機能要件)
4. [システム構成](#4-システム構成)
5. [データベース設計](#5-データベース設計)
6. [ユーザーストーリー](#6-ユーザーストーリー)
7. [UI/UX要件](#7-uiux要件)
8. [開発優先順位](#8-開発優先順位)
9. [技術スタック](#9-技術スタック)
10. [リスクと対策](#10-リスクと対策)
11. [成功指標](#11-成功指標)

---

## 1. プロジェクト概要

### 1.1 目的

- 1分単位の正確な時間計測の実現
- 曖昧な時間管理の是正
- 100人超えの組織拡大に対応可能なシステム構築
- 時間あたり採算分析の実現

### 1.2 背景

**現状の課題:**
- スプレッドシート管理による曖昧な時間管理が発生
- 1分単位の正確な計測ができていない
- 100人を超えた際にスプレッドシート管理では限界が予想される

**解決策:**
- Supabaseベースのスケーラブルな勤怠管理システム構築
- 打刻による正確な時間記録
- 自動集計・分析機能

### 1.3 スケジュール

- **開発期間**: 2025年11月11日 〜 11月20日
- **本番稼働**: 2025年12月1日

### 1.4 システム進化ロードマップ

```
Phase 1 (2025年12月〜)
├─ Webアプリ + Slack連携
├─ 基本的な打刻機能
└─ スプレッドシート自動出力

Phase 2 (時期未定)
├─ iOSネイティブアプリ
├─ 位置情報記録
├─ プロジェクト別工数管理
└─ 高度な分析機能

Phase 3 (将来)
└─ Androidアプリ
```

---

## 2. 機能要件

### 2.1 コア機能

#### 2.1.1 打刻機能

**出勤打刻**
- ワンタップで出勤時刻を記録
- 記録精度: 1分単位
- タイムスタンプを自動付与

**退勤打刻**
- ワンタップで退勤時刻を記録
- 自動的に実働時間を計算
- 退勤時にその日の勤務サマリーを表示

**休憩機能**
- 休憩開始/終了ボタンを提供
- 1日の休憩時間上限: **1時間**
- 複数回の休憩に対応(合計1時間まで)
- 累計1時間に達したら休憩ボタンを無効化
- 休憩しない人は休憩ボタンを押さなくてOK

**例:**
```
ケース1: 休憩1回
12:00-13:00 (60分) → 残り0分、ボタン無効化

ケース2: 休憩複数回
12:00-12:30 (30分) → 残り30分
15:00-15:30 (30分) → 残り0分、ボタン無効化

ケース3: 休憩なし
休憩ボタンを一度も押さない → フル実働時間として計算
```

**打刻修正**
- 管理者のみが修正可能
- 修正履歴を完全記録(監査ログ)

**位置情報記録 (Phase 2)**
- GPS位置情報の記録
- 不正打刻の抑止

#### 2.1.2 TODO機能

**今日のTODOリスト**
- 日付ごとにTODOリストを作成
- TODOリスト名をカスタマイズ可能(デフォルト: "今日のtodo")
- 進捗率を自動計算・表示
- タスク完了数を表示(例: 2/5 タスク完了)

**TODOアイテム管理**
- タスクの追加・編集・削除
- タスクの完了/未完了切り替え
- タスクの並び替え(ドラッグ&ドロップ)
- シンプルなチェックボックスUI

**連携機能**
- 打刻画面に統合表示
- 退勤時に未完了タスクを確認
- 翌日への持ち越し機能(オプション)

#### 2.1.3 通知機能

**Slack通知**

出勤時:
```
🌅 ◯◯さんが出勤しました
⏰ 09:00
```

退勤時:
```
🌆 ◯◯さんが退勤しました
⏰ 18:30
📊 勤務時間: 8時間30分
   (休憩: 1時間 / 実働: 7時間30分)
```

**通知設定:**
- 通知先: 全社チャンネルまたは管理者専用チャンネル
- 通知のON/OFF設定可能

#### 2.1.4 データ出力機能

**自動スプレッドシート出力**

- **実行タイミング**: 毎日11:00 AM
- **出力形式**: 個人別Googleスプレッドシート
- **出力内容**:

| 日付 | 出勤時刻 | 退勤時刻 | 休憩時間 | 実働時間 | 備考 |
|------|----------|----------|----------|----------|------|
| 2025/12/01 | 09:00 | 18:00 | 1:00 | 8:00 | - |
| 2025/12/02 | 09:15 | 18:30 | 1:00 | 8:15 | - |

- **集計行**: 月次合計を自動計算

#### 2.1.5 集計・分析機能

**個人別集計**
- 日次勤務時間
- 週次勤務時間
- 月次勤務時間
- 残業時間(8時間超過分)

**ダッシュボード (Phase 2)**
- リアルタイム出勤状況
- 月間勤務カレンダー
- 工数分析グラフ

**時間あたり採算計算 (Phase 2)**
- 実働時間 × 時給 = 人件費
- 個人別コスト分析
- 部署別コスト分析
- プロジェクト別工数分析

---

## 3. 非機能要件

### 3.1 パフォーマンス

| 項目 | 要件 |
|------|------|
| 打刻レスポンス時間 | 1秒以内 |
| データ同期 | リアルタイム |
| 同時接続数 | 100人以上 |
| ページ読み込み時間 | 3秒以内 |

### 3.2 セキュリティ

**認証・認可**
- Supabase Authによるユーザー認証
- Role-Based Access Control (RBAC)
  - **一般ユーザー**: 自分の打刻データのみ閲覧・操作
  - **管理者**: 全員の打刻データ閲覧・修正可能

**データ保護**
- SSL/TLS通信による暗号化
- データベースレベルでのRow Level Security (RLS)
- APIキーの環境変数管理

**監査ログ**
- 全ての打刻操作を記録
- 修正履歴の完全保存
- 不正操作の検知

### 3.3 可用性

- **稼働率**: 99.9%以上
- **バックアップ**: 日次自動バックアップ
- **災害復旧**: RPO 24時間以内、RTO 1時間以内

### 3.4 スケーラビリティ

- **ユーザー数**: 500人まで対応可能
- **データ保持期間**: 最低3年
- **トランザクション処理**: 1秒あたり100リクエスト以上

### 3.5 保守性

- コードの可読性を重視
- ドキュメントの整備
- エラーログの詳細記録

---

## 4. システム構成

### 4.1 Phase 1 アーキテクチャ (2025年12月〜)

```
┌─────────────────────────┐
│   ユーザーインターフェース   │
│   - Webアプリ            │
│   - Slackボット          │
└───────────┬─────────────┘
            │
            ↓
┌─────────────────────────┐
│      Supabase           │
│  ┌──────────────────┐   │
│  │  PostgreSQL DB   │   │
│  │  - users         │   │
│  │  - attendances   │   │
│  │  - logs          │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │  Supabase Auth   │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │  Edge Functions  │   │
│  │  - Slack通知     │   │
│  └──────────────────┘   │
│  ┌──────────────────┐   │
│  │  Realtime        │   │
│  └──────────────────┘   │
└───────────┬─────────────┘
            │
    ┌───────┴────────┐
    ↓                ↓
┌─────────┐    ┌─────────────┐
│  Slack  │    │     GAS     │
│ Webhook │    │(スプシ自動出力)│
└─────────┘    └─────────────┘
```

### 4.2 Phase 2 アーキテクチャ (ネイティブアプリ化)

```
┌──────────────────────────────┐
│     Native Applications      │
│  ┌────────────────────────┐  │
│  │  iOS App               │  │
│  │  (Swift + SwiftUI)     │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  Android App (将来)    │  │
│  │  (Kotlin + Jetpack)    │  │
│  └────────────────────────┘  │
└──────────────┬───────────────┘
               │
               ↓
┌──────────────────────────────┐
│         Supabase             │
│  (Phase 1と同じ構成)          │
└──────────────┬───────────────┘
               │
       ┌───────┴────────┐
       ↓                ↓
┌──────────┐      ┌─────────────┐
│  APNS/   │      │  Web Admin  │
│  FCM     │      │  Dashboard  │
│(Push通知) │      │             │
└──────────┘      └─────────────┘
```

### 4.3 データフロー

**打刻フロー:**
```
1. ユーザーが「出勤」ボタンをタップ
   ↓
2. Supabaseにデータ送信 (API経由)
   ↓
3. PostgreSQLにタイムスタンプ記録
   ↓
4. Edge Functionがトリガー
   ↓
5. Slack Webhookで通知送信
   ↓
6. Realtimeでダッシュボード更新
```

**データ出力フロー:**
```
1. GASがトリガー実行 (毎日11:00)
   ↓
2. Supabase APIから前日データ取得
   ↓
3. 個人別にデータを整形
   ↓
4. Googleスプレッドシートに書き込み
   ↓
5. 完了通知をSlackに送信
```

---

## 5. データベース設計

### 5.1 ER図

```
┌─────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   users     │ 1     * │   attendances    │ 1     * │ attendance_logs │
│─────────────│◄────────│──────────────────│◄────────│─────────────────│
│ id (PK)     │         │ id (PK)          │         │ id (PK)         │
│ email       │         │ user_id (FK)     │         │ attendance_id   │
│ name        │    │    │ date             │         │ action_type     │
│ employee_id │    │    │ clock_in         │         │ timestamp       │
│ role        │    │    │ clock_out        │         │ modified_by     │
│ department  │    │    │ break_sessions   │         │ before_value    │
└─────────────┘    │    │ total_break_min  │         │ after_value     │
                   │    │ total_work_min   │         └─────────────────┘
                   │    │ status           │
                   │    └──────────────────┘
                   │
                   │    ┌──────────────────┐
                   │  * │   todo_lists     │
                   └────│──────────────────│
                        │ id (PK)          │
                        │ user_id (FK)     │  1
                        │ date             │  │
                        │ title            │  │
                        └──────────────────┘  │
                                              │
                                              │  *
                                        ┌──────────────┐
                                        │  todo_items  │
                                        │──────────────│
                                        │ id (PK)      │
                                        │ list_id (FK) │
                                        │ content      │
                                        │ is_completed │
                                        │ order_index  │
                                        └──────────────┘
```

### 5.2 テーブル定義

#### users (ユーザー情報)

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  employee_id VARCHAR(50) UNIQUE NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  department VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_employee_id ON users(employee_id);
```

**カラム説明:**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | ユーザーID |
| email | VARCHAR(255) | NOT NULL, UNIQUE | メールアドレス |
| name | VARCHAR(100) | NOT NULL | 氏名 |
| employee_id | VARCHAR(50) | NOT NULL, UNIQUE | 社員番号 |
| role | VARCHAR(20) | NOT NULL | 権限 (admin/user) |
| department | VARCHAR(100) | - | 部署名 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

#### attendances (勤怠記録)

```sql
CREATE TABLE attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  break_sessions JSONB DEFAULT '[]'::jsonb,
  break_minutes_used INTEGER DEFAULT 0,
  total_work_minutes INTEGER DEFAULT 0,
  notes TEXT,
  status VARCHAR(20) DEFAULT 'working' CHECK (status IN ('working', 'completed', 'absent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- インデックス
CREATE INDEX idx_attendances_user_id ON attendances(user_id);
CREATE INDEX idx_attendances_date ON attendances(date);
CREATE INDEX idx_attendances_status ON attendances(status);
CREATE INDEX idx_attendances_user_date ON attendances(user_id, date);
```

**カラム説明:**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | 勤怠記録ID |
| user_id | UUID | FK, NOT NULL | ユーザーID |
| date | DATE | NOT NULL | 勤務日 |
| clock_in | TIMESTAMPTZ | - | 出勤時刻 |
| clock_out | TIMESTAMPTZ | - | 退勤時刻 |
| break_sessions | JSONB | DEFAULT '[]' | 休憩記録 |
| break_minutes_used | INTEGER | DEFAULT 0 | 使用済み休憩時間(分) |
| total_work_minutes | INTEGER | DEFAULT 0 | 総勤務時間(分) |
| notes | TEXT | - | 備考 |
| status | VARCHAR(20) | DEFAULT 'working' | 状態 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

**break_sessions JSONBフォーマット:**
```json
[
  {
    "start": "2025-12-01T12:00:00+09:00",
    "end": "2025-12-01T12:30:00+09:00",
    "minutes": 30
  },
  {
    "start": "2025-12-01T15:00:00+09:00",
    "end": "2025-12-01T15:15:00+09:00",
    "minutes": 15
  }
]
```

#### attendance_logs (打刻履歴・監査ログ)

```sql
CREATE TABLE attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID NOT NULL REFERENCES attendances(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
    'clock_in', 'clock_out', 'break_start', 'break_end', 'edit', 'delete'
  )),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_by UUID REFERENCES users(id),
  before_value JSONB,
  after_value JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_attendance_logs_attendance_id ON attendance_logs(attendance_id);
CREATE INDEX idx_attendance_logs_timestamp ON attendance_logs(timestamp);
CREATE INDEX idx_attendance_logs_action_type ON attendance_logs(action_type);
```

**カラム説明:**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | ログID |
| attendance_id | UUID | FK, NOT NULL | 勤怠記録ID |
| action_type | VARCHAR(50) | NOT NULL | アクション種別 |
| timestamp | TIMESTAMPTZ | NOT NULL | 実行日時 |
| modified_by | UUID | FK | 操作者ID |
| before_value | JSONB | - | 変更前の値 |
| after_value | JSONB | - | 変更後の値 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |

#### todo_lists (TODOリスト)

```sql
CREATE TABLE todo_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  title VARCHAR(100) DEFAULT '今日のtodo',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- インデックス
CREATE INDEX idx_todo_lists_user_id ON todo_lists(user_id);
CREATE INDEX idx_todo_lists_date ON todo_lists(date);
CREATE INDEX idx_todo_lists_user_date ON todo_lists(user_id, date);
```

**カラム説明:**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | TODOリストID |
| user_id | UUID | FK, NOT NULL | ユーザーID |
| date | DATE | NOT NULL | 対象日付 |
| title | VARCHAR(100) | DEFAULT '今日のtodo' | リストタイトル |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

#### todo_items (TODOアイテム)

```sql
CREATE TABLE todo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_list_id UUID NOT NULL REFERENCES todo_lists(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス
CREATE INDEX idx_todo_items_list_id ON todo_items(todo_list_id);
CREATE INDEX idx_todo_items_order ON todo_items(todo_list_id, order_index);
```

**カラム説明:**

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | UUID | PK | TODOアイテムID |
| todo_list_id | UUID | FK, NOT NULL | TODOリストID |
| content | TEXT | NOT NULL | タスク内容 |
| is_completed | BOOLEAN | DEFAULT false | 完了フラグ |
| order_index | INTEGER | DEFAULT 0 | 表示順序 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | 作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | 更新日時 |

### 5.3 Row Level Security (RLS) ポリシー

```sql
-- usersテーブル
-- ユーザーは自分の情報のみ閲覧可能、管理者は全員閲覧可能
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- attendancesテーブル
-- ユーザーは自分の勤怠のみ操作可能、管理者は全員操作可能
ALTER TABLE attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own attendance"
  ON attendances FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all attendance"
  ON attendances FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- attendance_logsテーブル
-- 管理者のみ閲覧可能
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view logs"
  ON attendance_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- todo_listsテーブル
-- ユーザーは自分のTODOリストのみ操作可能
ALTER TABLE todo_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own todo lists"
  ON todo_lists FOR ALL
  USING (user_id = auth.uid());

-- todo_itemsテーブル
-- ユーザーは自分のTODOアイテムのみ操作可能
ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own todo items"
  ON todo_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM todo_lists
      WHERE todo_lists.id = todo_items.todo_list_id
      AND todo_lists.user_id = auth.uid()
    )
  );
```

---

## 6. ユーザーストーリー

### 6.1 一般ユーザー

#### Story 1: 出勤打刻
```
As a 社員
I want to 出勤時にワンタップで打刻する
So that 正確な出勤時刻が記録され、Slackで通知される

Acceptance Criteria:
- [ ] 「出勤」ボタンを押すと1秒以内に打刻完了
- [ ] 打刻成功時にフィードバック表示
- [ ] Slackに出勤通知が送信される
- [ ] 二重打刻を防止する
```

#### Story 2: 退勤打刻
```
As a 社員
I want to 退勤時にワンタップで打刻する
So that その日の勤務時間が自動計算され、確認できる

Acceptance Criteria:
- [ ] 「退勤」ボタンを押すと1秒以内に打刻完了
- [ ] 退勤時にその日のサマリーが表示される
  - 出勤時刻
  - 退勤時刻
  - 休憩時間
  - 実働時間
- [ ] Slackに退勤通知が送信される
```

#### Story 3: 休憩打刻
```
As a 社員
I want to 休憩開始と終了を記録する
So that 正確な実働時間が計算される

Acceptance Criteria:
- [ ] 「休憩開始」ボタンで休憩モードに入る
- [ ] 休憩中は残り休憩可能時間を表示
- [ ] 「休憩終了」ボタンで勤務モードに戻る
- [ ] 累計1時間に達したら休憩ボタンが無効化される
- [ ] 休憩しない場合はボタンを押さなくてもOK
```

#### Story 4: 今日のTODO管理
```
As a 社員
I want to その日のタスクをTODOリストで管理する
So that やるべきことを忘れずに完了できる

Acceptance Criteria:
- [ ] 打刻画面でTODOリストが表示される
- [ ] タスクの追加・編集・削除ができる
- [ ] チェックボックスでタスクの完了/未完了を切り替えられる
- [ ] 進捗率が自動計算される (例: 2/5タスク完了 = 40%)
- [ ] TODOリスト名を編集できる
```

#### Story 5: 勤務時間確認
```
As a 社員
I want to 自分の今月の勤務時間を確認する
So that 労働時間を把握できる

Acceptance Criteria:
- [ ] 今月の累計勤務時間が表示される
- [ ] 日別の勤務時間一覧が閲覧できる
- [ ] カレンダー形式で勤務日が視覚的に確認できる
```

### 6.2 管理者

#### Story 6: 全員の打刻状況確認
```
As a 管理者
I want to リアルタイムで全員の出退勤状況を確認する
So that 誰が出社しているか即座に把握できる

Acceptance Criteria:
- [ ] 現在出勤中の社員一覧が表示される
- [ ] 各社員の出勤時刻と経過時間が表示される
- [ ] 休憩中の社員が区別して表示される
```

#### Story 7: 打刻修正
```
As a 管理者
I want to 打刻漏れや誤打刻を修正する
So that 正確な勤怠データを維持できる

Acceptance Criteria:
- [ ] 任意の社員の打刻データを編集できる
- [ ] 修正理由を入力できる
- [ ] 修正履歴が完全に記録される
- [ ] 修正前後の値が比較できる
```

#### Story 8: 採算分析
```
As a 管理者
I want to 部署別・個人別の時間あたり採算を確認する
So that 人件費管理と生産性分析ができる

Acceptance Criteria:
- [ ] 個人別の月次人件費が計算される
- [ ] 部署別の集計が表示される
- [ ] CSVエクスポート機能がある
```

#### Story 9: スプレッドシート確認
```
As a 管理者
I want to 毎日11時に自動生成されるスプレッドシートを確認する
So that 正確なデータが出力されているか確認できる

Acceptance Criteria:
- [ ] 個人別シートが自動生成される
- [ ] 前日の勤怠データが正確に記録されている
- [ ] 月次集計行が自動計算されている
```

---

## 7. UI/UX要件

### 7.1 打刻画面 (最重要)

**デザイン原則:**
- **シンプルさ**: 余計な情報を排除、必要な操作だけ
- **視認性**: 現在の状態が一目でわかる
- **フィードバック**: 操作後の結果が明確

**画面構成:**

```
┌─────────────────────────────┐
│   FDGroup 勤怠管理           │
├─────────────────────────────┤
│                             │
│   こんにちは、山田さん        │
│                             │
│   [現在の状態: 出勤中]       │
│                             │
│   ⏰ 09:00 - 現在 12:30     │
│   📊 勤務時間: 3時間30分     │
│                             │
│   ┌─────────────────────┐   │
│   │   🟢 退勤する        │   │
│   └─────────────────────┘   │
│                             │
│   ┌─────────────────────┐   │
│   │   ☕ 休憩開始         │   │
│   │   残り: 1時間00分    │   │
│   └─────────────────────┘   │
│                             │
├─────────────────────────────┤
│   📝 今日のtodo   ✏️ 🗑️     │
│   ────────────────           │
│   進捗: 33%                 │
│   1/3 タスク完了             │
│                             │
│   ☑ 企画書作成              │
│   ☐ ミーティング準備         │
│   ☐ メール返信              │
│                             │
│   ▶️ アクションを入力...     │
├─────────────────────────────┤
│   📅 今月の勤務: 15日       │
│   ⏱️  累計: 120時間30分     │
│                             │
└─────────────────────────────┘
```

**状態別UI:**

**1. 未出勤状態:**
```
[現在の状態: 未出勤]

┌─────────────────────┐
│   🌅 出勤する        │  ← 大きく目立つボタン
└─────────────────────┘
```

**2. 出勤中状態:**
```
[現在の状態: 出勤中]
⏰ 09:00 - 現在 12:30

┌─────────────────────┐
│   🌆 退勤する        │
└─────────────────────┘

┌─────────────────────┐
│   ☕ 休憩開始         │
│   残り: 1時間00分    │
└─────────────────────┘
```

**3. 休憩中状態:**
```
[現在の状態: 休憩中]
☕ 12:30 - 現在 12:45 (15分経過)

┌─────────────────────┐
│   🟢 休憩終了         │
└─────────────────────┘

残り休憩可能時間: 45分
```

**4. 退勤済み状態:**
```
[本日の勤務は終了しました]

📊 今日の勤務サマリー
⏰ 09:00 - 18:30
☕ 休憩: 1時間00分
⏱️  実働: 8時間30分

お疲れ様でした!
```

### 7.2 ダッシュボード (管理者向け)

```
┌─────────────────────────────────────────┐
│  FDGroup 勤怠管理 - 管理画面              │
├─────────────────────────────────────────┤
│  📊 リアルタイム出勤状況                  │
│  ────────────────────────────            │
│  現在出勤中: 25人 / 40人                 │
│                                         │
│  🟢 出勤中 (20人)                        │
│  山田太郎  09:00 - (3h 30m)              │
│  佐藤花子  09:15 - (3h 15m)              │
│  ...                                    │
│                                         │
│  ☕ 休憩中 (5人)                         │
│  田中一郎  12:30 - (15m / 残45m)         │
│  ...                                    │
├─────────────────────────────────────────┤
│  📅 月次サマリー (11月)                   │
│  ────────────────────────────            │
│  総勤務時間: 5,200時間                   │
│  平均勤務時間/人: 208時間                │
│  総人件費: ¥8,320,000                   │
└─────────────────────────────────────────┘
```

### 7.3 レスポンシブデザイン

- **モバイルファースト**: スマホでの操作を最優先
- **タブレット対応**: 管理者ダッシュボード用
- **PC対応**: 管理画面・分析画面用

### 7.4 アクセシビリティ

- 十分なコントラスト比(WCAG AA準拠)
- タップターゲットサイズ: 最小44×44px
- フォントサイズ: 最小14px
- カラーユニバーサルデザイン対応

---

## 8. 開発優先順位

### 8.1 MVP (Minimum Viable Product) - 11/20まで

**Priority 1: 絶対に必要な機能**

- [ ] Supabaseプロジェクト作成・設定
- [ ] データベース構築(users, attendances, logs, todo_lists, todo_items)
- [ ] 打刻WebアプリUI
  - [ ] 出勤打刻
  - [ ] 退勤打刻
- [ ] TODO機能
  - [ ] TODOリスト表示
  - [ ] タスク追加・編集・削除
  - [ ] タスク完了/未完了切り替え
  - [ ] 進捗率表示
- [ ] Slack通知連携
  - [ ] 出勤通知
  - [ ] 退勤通知
- [ ] GASによるスプレッドシート自動出力

**Phase 1完了の定義:**
```
✅ ユーザーが出退勤を打刻できる
✅ TODOリストでタスク管理ができる
✅ Slackに通知が届く
✅ 毎日11時にスプレッドシートが生成される
✅ 40人が問題なく使える
```

### 8.2 Phase 1.5 - 12月中

**Priority 2: あると便利な機能**

- [ ] 休憩機能
  - [ ] 休憩開始/終了ボタン
  - [ ] 1時間上限制御
- [ ] 管理者ダッシュボード
  - [ ] リアルタイム出勤状況
  - [ ] 全員の打刻データ閲覧
- [ ] 打刻修正機能
  - [ ] 管理者による修正
  - [ ] 修正履歴記録
- [ ] 月次集計レポート
  - [ ] 個人別集計
  - [ ] CSV出力

### 8.3 Phase 2 - 時期未定

**Priority 3: 将来的な機能**

- [ ] iOSネイティブアプリ開発
- [ ] プッシュ通知
- [ ] 位置情報記録(GPS)
- [ ] プロジェクト別工数管理
- [ ] 部署別分析ダッシュボード
- [ ] 高度な採算分析
- [ ] Androidアプリ開発

---

## 9. 技術スタック

### 9.1 Phase 1 (Webアプリ)

**フロントエンド**
- HTML5 / CSS3
- JavaScript (Vanilla or React)
- Tailwind CSS (スタイリング)

**バックエンド**
- Supabase
  - PostgreSQL (データベース)
  - Supabase Auth (認証)
  - Realtime (リアルタイム同期)
  - Edge Functions (サーバーレス関数)

**自動化・連携**
- Google Apps Script (スプレッドシート出力)
- Slack Webhook API (通知)

**ホスティング**
- Vercel / Netlify (静的ホスティング)
- または Supabase Hosting

### 9.2 Phase 2 (ネイティブアプリ)

**iOS**
- Swift
- SwiftUI
- Supabase Swift Client

**Android (将来)**
- Kotlin
- Jetpack Compose
- Supabase Kotlin Client

**通知**
- Apple Push Notification Service (APNS)
- Firebase Cloud Messaging (FCM)

### 9.3 開発ツール

- **バージョン管理**: Git + GitHub
- **プロジェクト管理**: GitHub Projects / Notion
- **API テスト**: Postman / Insomnia
- **デザイン**: Figma (必要に応じて)

---

## 10. リスクと対策

### 10.1 リスク管理表

| リスク | 発生確率 | 影響度 | 対策 |
|--------|----------|--------|------|
| 11/20までに完成しない | 中 | 高 | MVP機能に絞る、段階的リリース |
| Supabase障害 | 低 | 中 | オフライン対応検討、バックアップDB |
| ユーザーの打刻忘れ | 高 | 中 | Slack通知、管理者修正機能 |
| 不正打刻(代理打刻) | 低 | 中 | Phase2で位置情報・顔認証導入 |
| データ消失 | 低 | 高 | 日次バックアップ、監査ログ |
| パフォーマンス劣化 | 低 | 中 | インデックス最適化、クエリ改善 |
| セキュリティ侵害 | 低 | 高 | RLS設定、定期的なセキュリティ監査 |

### 10.2 対応優先順位

**Critical (即座に対応)**
- データ消失
- セキュリティ侵害
- システム全体停止

**High (24時間以内に対応)**
- Supabase障害
- 打刻機能の不具合
- Slack通知の停止

**Medium (1週間以内に対応)**
- パフォーマンス劣化
- UI/UXの改善要望

**Low (時間のある時に対応)**
- マイナーなバグ
- 機能追加要望

---

## 11. 成功指標 (KPI)

### 11.1 定量的指標

| KPI | 目標値 | 測定方法 |
|-----|--------|----------|
| 打刻率 | 95%以上 | (打刻日数 / 勤務日数) × 100 |
| 打刻精度 | 誤打刻5%以下 | (修正回数 / 総打刻数) × 100 |
| システム稼働率 | 99.9%以上 | Uptime monitoring |
| 打刻レスポンス時間 | 平均1秒以内 | ログ分析 |
| ユーザー満足度 | 4.0/5.0以上 | 四半期アンケート |
| データ出力成功率 | 100% | GASログ確認 |

### 11.2 定性的指標

- **使いやすさ**: ユーザーが迷わず打刻できる
- **信頼性**: データの正確性に対する信頼
- **効率性**: 勤怠管理業務の時間削減
- **拡張性**: 新機能追加の容易さ

### 11.3 評価サイクル

- **日次**: システム稼働状況、打刻率
- **週次**: エラーログ確認、ユーザーフィードバック
- **月次**: KPI集計、改善点抽出
- **四半期**: 総合評価、次期計画策定

---

## 12. 付録

### 12.1 用語集

| 用語 | 説明 |
|------|------|
| 打刻 | 出勤・退勤・休憩の時刻を記録すること |
| 実働時間 | 総勤務時間から休憩時間を引いた時間 |
| RLS | Row Level Security - 行レベルのアクセス制御 |
| Edge Function | サーバーレスで実行される関数 |
| MVP | Minimum Viable Product - 最小限の機能を持つ製品 |

### 12.2 参考資料

- [Supabase公式ドキュメント](https://supabase.com/docs)
- [Slack Webhook API](https://api.slack.com/messaging/webhooks)
- [Google Apps Script](https://developers.google.com/apps-script)
- [労働基準法](https://www.mhlw.go.jp/)

### 12.3 変更履歴

| 日付 | バージョン | 変更内容 | 担当者 |
|------|------------|----------|--------|
| 2025/11/11 | 1.0 | 初版作成 | いっき |

---

**承認欄**

| 役割 | 氏名 | 承認日 | 署名 |
|------|------|--------|------|
| プロジェクトオーナー | | | |
| 開発責任者 | | | |
| システム管理者 | | | |

---

**END OF DOCUMENT**