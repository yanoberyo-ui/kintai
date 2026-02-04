# MG-001: DBマイグレーション作成

## 担当
Backend

## 要件
ミニゲーム機能用のDBスキーマを作成する。

### usersテーブル変更
```sql
ALTER TABLE users ADD COLUMN is_minigame_admin BOOLEAN DEFAULT false;
```

### 新規テーブル
1. `minigame_events` - イベントマスター
   - id, name, description, status (waiting/active/finished), created_at, updated_at

2. `minigame_participants` - 参加者（認証不要、session_idで識別）
   - id, event_id, session_id, name, checked_in_at

3. `minigame_tables` - テーブル/卓
   - id, event_id, table_number, capacity (default 4)

4. `minigame_seating` - 席配置
   - id, event_id, round_number, table_id, participant_id

5. `minigame_seating_history` - 同卓履歴（回避計算用）
   - id, event_id, participant_id_1, participant_id_2, round_number

6. `minigame_timer` - タイマー状態
   - id, event_id, started_at, duration_seconds, is_running

7. `minigame_missions` - ミッションマスター
   - id, content, difficulty (easy/medium/hard)

8. `minigame_participant_missions` - ミッション配布
   - id, event_id, participant_id, mission_id, completed

9. `minigame_topics` - お題カードマスター
   - id, content, category

10. `minigame_topic_draws` - お題引いた履歴
    - id, event_id, table_id, round_number, topic_id, drawn_at

### RLS設定
- 参加者テーブルは認証不要でアクセス可能にする
- 管理系テーブルはis_minigame_admin=trueのユーザーのみ編集可能

### Realtime有効化
- minigame_timer
- minigame_seating
- minigame_participants

## 完了条件
- [ ] マイグレーションファイル `supabase/migrations/044_minigame_schema.sql` 作成
- [ ] ローカルで `supabase db reset` で動作確認
- [ ] PR作成
