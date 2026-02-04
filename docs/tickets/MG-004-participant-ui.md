# MG-004: 参加者画面実装

## 担当
Frontend

## 依存
MG-002完了後

## 要件
参加者向けUI実装。認証不要。`src/features/minigame/components/participant/` 配下。

### ファイル構成
```
src/features/minigame/components/participant/
├── MinigameApp.jsx      # エントリー（状態に応じて表示切替）
├── CheckInPage.jsx      # チェックイン画面
├── WaitingRoom.jsx      # 待機室
├── GameRound.jsx        # ゲーム中画面
└── Timer.jsx            # タイマー表示コンポーネント
```

### MinigameApp.jsx
- eventIdをpropsまたはURLパラメータで受け取り
- session_idをlocalStorageで管理（なければ生成）
- 状態に応じて画面切替:
  - 未チェックイン → CheckInPage
  - チェックイン済み＆イベントwaiting → WaitingRoom
  - イベントactive → GameRound
  - イベントfinished → 終了メッセージ

### CheckInPage.jsx
- 名前入力フォーム
- チェックインボタン
- シンプルなデザイン

### WaitingRoom.jsx
- 「待機中...」メッセージ
- 参加者一覧表示
- 自分の名前をハイライト
- リアルタイム更新

### GameRound.jsx
- 現在のラウンド表示
- 自分のテーブル番号表示（大きく）
- 同じテーブルのメンバー表示
- タイマー表示
- ミッション表示エリア（MG-005で実装）
- お題カード引くボタン（MG-005で実装）

### Timer.jsx
- 残り時間を大きく表示（mm:ss形式）
- 残り1分で色変更（警告色）
- 残り10秒でカウントダウン演出
- useTimerRealtimeフックを使用

### デザイン
- モバイルファースト（参加者はスマホ想定）
- 大きな文字、タップしやすいボタン
- Tailwind CSSで実装

## 完了条件
- [ ] 上記ファイル全て実装
- [ ] チェックイン→待機→ゲーム画面の流れが動作
- [ ] タイマーがリアルタイム同期される
- [ ] PR作成
