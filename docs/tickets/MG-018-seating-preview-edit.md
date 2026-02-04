# MG-018: 席配置プレビュー＆編集機能

## 担当
Backend → Frontend

## 要件
1. 管理者がシャッフル後に席配置をプレビューできる
2. 班員を入れ替えられる（テーブル間移動）
3. 「確定」ボタンで参加者に公開

## 現在の流れ
1. 「ゲーム開始」→ 自動シャッフル → 即公開
2. 「シャッフル」→ 自動シャッフル → 即公開

## 新しい流れ
1. 「ゲーム開始」or「シャッフル」→ 席配置作成（未確定）
2. 管理者がプレビューで確認
3. 必要なら班員を入れ替え
4. 「確定」→ 参加者に公開

## 実装

### Phase 1: DB変更（Backend）
```sql
-- 049_add_seating_confirmed.sql
ALTER TABLE minigame_seating
ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT false;
```

### Phase 2: ロジック変更（Backend/Frontend）
seating.js:
- `assignSeating`: is_confirmed = false で作成
- `confirmSeating(eventId, roundNumber)`: is_confirmed = true に更新
- `swapParticipants(seatingId1, seatingId2)`: 2人の席を入れ替え

### Phase 3: UI変更（Frontend）
EventControl.jsx:
1. 未確定の席配置がある場合、プレビューモード表示
2. 各テーブルの参加者をタップで選択
3. 2人選択したら「入れ替え」ボタン表示
4. 「確定」ボタンで公開
5. 「再シャッフル」ボタンで再度ランダム配置

### Phase 4: 参加者側の変更（Frontend）
GameRound.jsx / useEventRealtime.js:
- is_confirmed = true の席配置のみ表示
- 未確定中は「席を割り当て中...」表示

## UI案（EventControl）
```
┌─────────────────────────────────────┐
│ 席配置プレビュー（ラウンド2）        │
│ ※まだ参加者には見えていません       │
├─────────────────────────────────────┤
│ テーブル1          テーブル2        │
│ ┌─────────┐       ┌─────────┐      │
│ │ 田中 ☑  │       │ 山田    │      │
│ │ 佐藤    │       │ 鈴木 ☑  │      │
│ │ 高橋    │       │ 伊藤    │      │
│ └─────────┘       └─────────┘      │
│                                     │
│  [田中 ↔ 鈴木 を入れ替え]            │
│                                     │
│  [再シャッフル]  [確定して公開]      │
└─────────────────────────────────────┘
```

## 完了条件
- [ ] シャッフル後に席配置がプレビュー表示される
- [ ] 2人を選択して入れ替えができる
- [ ] 「確定」で参加者に公開される
- [ ] 未確定中、参加者には「席を割り当て中...」と表示
- [ ] 再シャッフルで再度ランダム配置できる
