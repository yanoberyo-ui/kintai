# MG-003: 管理者画面実装

## 担当
Frontend

## 依存
MG-002完了後

## 要件
管理者向けUI実装。`src/features/minigame/components/admin/` 配下。

### ファイル構成
```
src/features/minigame/components/admin/
├── MinigameAdmin.jsx    # 管理画面エントリー
├── EventList.jsx        # イベント一覧
├── EventCreate.jsx      # イベント作成モーダル
└── EventControl.jsx     # イベント操作画面
```

### MinigameAdmin.jsx
- イベント一覧表示
- 新規作成ボタン

### EventList.jsx
- イベント一覧（名前、ステータス、参加人数）
- クリックでEventControlへ

### EventCreate.jsx
- モーダル形式
- イベント名、説明入力
- 作成ボタン

### EventControl.jsx（メイン画面）
- 参加者一覧表示（リアルタイム更新）
- ステータス表示
- 操作ボタン:
  - 「ゲーム開始」→ 席分け実行 + status=active
  - 「シャッフル」→ 新ラウンドで席分け
  - 「タイマー開始」→ 5分タイマー（時間は調整可能）
  - 「タイマー停止/再開」
  - 「終了」→ status=finished
- 現在の席配置表示（テーブルごと）
- 参加用URL表示（コピーボタン付き）

### デザイン
- 既存のAdminPage.jsxを参考にTailwind CSSで実装
- シンプルで操作しやすいUI

## 完了条件
- [ ] 上記ファイル全て実装
- [ ] イベント作成→操作の流れが動作
- [ ] PR作成
