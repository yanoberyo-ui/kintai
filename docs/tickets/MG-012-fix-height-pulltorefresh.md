# MG-012: 縦幅問題 + Pull-to-refresh修正

## 担当
Frontend

## 問題
1. **縦幅が小さい**: PR #11で追加した `h-full overflow-y-auto` が親（`<main>`）にheightがないため機能せず、コンテンツが狭く表示される
2. **Pull-to-refreshが効かないページがある**: 同じ理由でスクロール判定が正しく動作しない

## 原因
- `App.jsx` の `<main>` タグにheight指定がない
- 各ページの `h-full overflow-y-auto` が親コンテナのheightに依存しているが、それがない

## 修正方針

### 方法A（推奨）: mainにheight設定
`App.jsx` の `<main>` タグに適切なheight設定を追加：

```jsx
<main className={`pt-24 md:pb-8 pb-32 px-8 transition-all duration-300 min-h-screen ${
  sidebarOpen ? 'md:ml-64' : 'md:ml-0'
} ml-0`}>
```

または、ページごとに固定heightを計算:
```jsx
<main className={`pt-24 md:pb-8 pb-32 px-8 transition-all duration-300 h-[calc(100vh-6rem)] overflow-hidden ${
```

### 方法B: 各ページからh-full削除
`h-full overflow-y-auto` を削除し、ブラウザネイティブのスクロールを使う:
- 各ページコンポーネントから `h-full overflow-y-auto` を削除
- Pull-to-refreshは `window` レベルで検知するように変更

## 対象ファイル
1. `src/App.jsx` - main タグの修正
2. `src/features/admin/components/MembersPage.jsx`
3. `src/features/announcements/components/AnnouncementsPage.jsx`
4. `src/features/calendar/components/CalendarPage.jsx`
5. `src/features/minigame/components/MinigamePage.jsx`
6. `src/features/minigame/components/admin/EventControl.jsx`

## 完了条件
- [ ] メンバーページの縦幅が画面いっぱいに表示される
- [ ] 全ページでPull-to-refreshが機能する
- [ ] モバイルで引っ張って離すとリロードされる
- [ ] PCでの表示に影響がない
