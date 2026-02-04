# MG-005: ミッション・お題機能

## 担当
Frontend

## 依存
MG-004完了後

## 要件
ミッション配布とお題カード機能の実装。

### ファイル構成
```
src/features/minigame/
├── utils/
│   ├── mission.js      # ミッション操作
│   └── topic.js        # お題カード操作
└── components/participant/
    ├── MissionList.jsx # ミッション表示
    └── TopicCard.jsx   # お題カード
```

### mission.js
```javascript
// ミッション一覧取得
export async function getMissions()

// 参加者にミッション配布（ランダムに3つ）
export async function assignMissions(eventId, participantId)

// 参加者のミッション取得
export async function getParticipantMissions(eventId, participantId)

// ミッション完了マーク
export async function completeMission(participantMissionId)
```

### topic.js
```javascript
// お題一覧取得
export async function getTopics()

// お題を引く（テーブル単位、同じお題は出ない）
export async function drawTopic(eventId, tableId, roundNumber)

// テーブルの引いたお題履歴取得
export async function getDrawnTopics(eventId, tableId, roundNumber)
```

### MissionList.jsx
- 自分のミッション3つ表示
- チェックボックスで完了マーク
- 例: 「隣の人に質問する」「全員と目を合わせる」

### TopicCard.jsx
- 「お題を引く」ボタン
- 引いたらカード風に表示
- アニメーション付き（めくる演出）
- 同じテーブルの人は同じお題を見る

### 初期データ
マイグレーションまたはシードで以下を投入:

**ミッション例（10個程度）**
- 隣の人に質問してみよう
- 今日の出来事を1つ共有しよう
- 相手の話に相槌を打とう
- 笑顔で話そう
- 相手の名前を呼んでみよう

**お題例（20個程度）**
- 最近ハマっていること
- 子供の頃の夢
- おすすめの映画/本
- 行ってみたい場所
- 最近嬉しかったこと

## 完了条件
- [ ] utils実装
- [ ] コンポーネント実装
- [ ] GameRound.jsxに統合
- [ ] 初期データ投入
- [ ] PR作成
