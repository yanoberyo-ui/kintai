# MG-016: パーソナライズドミッション + 回答入力

## 担当
Backend → Frontend

## 要件
1. ミッションに同席メンバーの名前を含める
   - 例: 「〇〇さんとの共通点を1つ見つけよう」
   - 例: 「〇〇さんに質問してみよう」
2. ミッションに回答を入力できるテキストボックスを追加
   - 例: 共通点が何だったかを記録

## 実装

### Phase 1: DB変更（Backend）
```sql
-- 048_add_mission_answer.sql
ALTER TABLE minigame_participant_missions
ADD COLUMN answer TEXT,
ADD COLUMN target_participant_id UUID REFERENCES minigame_participants(id);
```

### Phase 2: ミッションマスター変更（Backend）
minigame_missions テーブルに `{name}` プレースホルダーを使うミッションを追加:
```sql
UPDATE minigame_missions SET content = '{name}さんに質問してみよう' WHERE content = '隣の人に質問してみよう';
-- 新規追加
INSERT INTO minigame_missions (content, difficulty) VALUES
  ('{name}さんとの共通点を1つ見つけよう', 'medium'),
  ('{name}さんの良いところを1つ伝えよう', 'medium'),
  ('{name}さんの趣味について聞いてみよう', 'easy');
```

### Phase 3: 配布ロジック変更（Backend/Frontend）
mission.js の assignMissions を修正:
1. 同席メンバーリストを引数に追加
2. `{name}` を同席メンバーからランダムに選んで置換
3. target_participant_id を保存

### Phase 4: UI変更（Frontend）
MissionList.jsx:
1. 各ミッションの下にテキスト入力欄を追加
2. 入力値を answer カラムに保存
3. チェックボックスとは独立して保存

## 完了条件
- [ ] ミッションに同席メンバーの名前が表示される
- [ ] ミッションごとにテキスト入力欄がある
- [ ] 入力した回答が保存される
- [ ] 次回同じイベントに参加しても回答が残っている
