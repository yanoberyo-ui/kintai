# ミニゲーム機能 WBS

## 目標
今日中リリース（MVP）

## 担当割り振り

| チケット | 担当 | 内容 | 依存 |
|---------|------|------|------|
| MG-001 | backend | DBマイグレーション | - |
| MG-002 | backend | utils基盤（event, participant, seating, timer） | MG-001 |
| MG-003 | frontend | 管理者画面（EventCreate, EventList, EventControl） | MG-002 |
| MG-004 | frontend | 参加者画面（CheckIn, WaitingRoom, GameRound, Timer） | MG-002 |
| MG-005 | frontend | ミッション・お題機能 | MG-002 |
| MG-006 | frontend | ルーティング統合・初期データ | MG-003,004,005 |

## 進捗

- [x] MG-001: DBマイグレーション ✅ 16:20完了
- [x] MG-002: utils基盤 ✅ 16:30完了
- [x] MG-003: 管理者画面 ✅ 16:45完了
- [x] MG-004: 参加者画面 ✅ 16:45完了
- [x] MG-005: ミッション・お題 ✅ 17:00完了
- [x] MG-006: 統合 ✅ 17:00完了

## 🎉 リリース完了！

## タイムライン（目安）

16:15 MG-001開始
16:30 MG-001完了 → MG-002開始
17:00 MG-002完了 → MG-003,004並行開始
18:00 MG-003,004完了 → MG-005開始
18:30 MG-005完了 → MG-006開始
19:00 リリース
