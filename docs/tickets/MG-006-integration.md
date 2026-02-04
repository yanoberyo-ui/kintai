# MG-006: ルーティング統合

## 担当
Frontend

## 依存
MG-003, MG-004, MG-005完了後

## 要件
App.jsxへの統合とサイドバーへのリンク追加。

### App.jsx修正
```javascript
// 追加するページ
// currentPage === 'minigame-admin' → <MinigameAdmin />
// currentPage === 'minigame' → <MinigameApp eventId={eventIdFromUrl} />
```

### サイドバー修正
- is_minigame_admin=true のユーザーに「ミニゲーム管理」リンク表示
- アイコン: ゲームコントローラー的なもの（Heroicons使用）

### 参加者用URL設計
- `/minigame?event=EVENT_ID` 形式
- または `/minigame/EVENT_ID` 形式
- 認証不要でアクセス可能

### 動作確認項目
1. 管理者: サイドバーからミニゲーム管理にアクセス
2. 管理者: イベント作成
3. 管理者: 参加用URLをコピー
4. 参加者: URLにアクセス→チェックイン
5. 管理者: 参加者確認→ゲーム開始
6. 参加者: 席配置表示→タイマー動作
7. 管理者: シャッフル→参加者画面更新確認

## 完了条件
- [ ] App.jsx修正
- [ ] サイドバー修正
- [ ] 全体フロー動作確認
- [ ] PR作成
