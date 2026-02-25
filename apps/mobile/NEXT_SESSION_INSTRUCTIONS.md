# 次のセッションでやること

## 指示
Web版（apps/web）の全画面のUIを徹底的に調査し、モバイル版（apps/mobile）でWeb版と全く同じUIを再現する。

## 手順

1. **Serenaのメモリ `mobile-app-redesign-plan` を読む**
2. **Web版のApp.jsxを読んでナビゲーション構造を理解する**
3. **Web版のHomeScreen.tsxを読んでホーム画面の構成を理解する**
4. **主要な各feature画面を読んでUI要素を把握する**
5. **EnterPlanModeで設計をユーザーに提示し、承認を得る**
6. **承認後、画面ごとにモバイル版を実装する**

## 絶対に守ること
- 設計なしにコードを書き始めない
- Web版のDBクエリ・ビジネスロジックを正確に移植する
- feature/native-appブランチの古いコードに頼らない
- Web版のビルドを壊さない
