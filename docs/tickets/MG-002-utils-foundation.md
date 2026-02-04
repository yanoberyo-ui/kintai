# MG-002: utils基盤実装

## 担当
Backend

## 依存
MG-001完了後

## 要件
`src/features/minigame/utils/` 配下にSupabase操作関数を実装。

### ファイル構成
```
src/features/minigame/
├── utils/
│   ├── event.js        # イベントCRUD
│   ├── participant.js  # 参加者操作
│   ├── seating.js      # 席分けアルゴリズム
│   └── timer.js        # タイマー操作
└── hooks/
    ├── useEventRealtime.js  # イベント状態購読
    └── useTimerRealtime.js  # タイマー購読
```

### event.js
```javascript
// イベント作成
export async function createEvent(name, description)

// イベント一覧取得
export async function getEvents()

// イベント取得
export async function getEvent(eventId)

// イベントステータス更新
export async function updateEventStatus(eventId, status)
```

### participant.js
```javascript
// チェックイン（session_idはlocalStorageで管理）
export async function checkIn(eventId, name, sessionId)

// 参加者一覧取得
export async function getParticipants(eventId)

// session_idから参加者取得
export async function getParticipantBySession(eventId, sessionId)
```

### seating.js
```javascript
// 席分け実行
// 1. 1卓4人基本（3-5人で調整）
// 2. seating_historyから同卓回数マトリクス作成
// 3. グリーディ法で同卓回数最小化
export async function assignSeating(eventId, roundNumber)

// 現在の席配置取得
export async function getCurrentSeating(eventId, roundNumber)

// テーブル作成（参加人数に応じて自動生成）
export async function createTables(eventId, participantCount)
```

### timer.js
```javascript
// タイマー開始
export async function startTimer(eventId, durationSeconds)

// タイマー一時停止
export async function pauseTimer(eventId)

// タイマー再開
export async function resumeTimer(eventId)

// タイマー状態取得
export async function getTimerState(eventId)
```

### useTimerRealtime.js
```javascript
// Supabase Realtimeでタイマー購読
// started_at + duration_seconds - now で残り時間計算
export function useTimerRealtime(eventId)
// returns: { remainingSeconds, isRunning }
```

### useEventRealtime.js
```javascript
// イベント状態・参加者リスト購読
export function useEventRealtime(eventId)
// returns: { event, participants, seating }
```

## 完了条件
- [ ] 上記ファイル全て実装
- [ ] 基本的な動作確認（コンソールから関数呼び出し）
- [ ] PR作成
