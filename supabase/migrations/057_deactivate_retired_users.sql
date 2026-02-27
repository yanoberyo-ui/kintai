-- =====================================================
-- 退職者アカウントの無効化
-- 実行日: 2026-02-28
-- =====================================================

-- 対象者のアカウントを無効化（is_deactivated = true）
-- ※ データは保持したまま、ログインを制限する

UPDATE users
SET is_deactivated = true
WHERE name IN (
  '永井なずな',
  '野口奈々',
  '石谷南斗',
  '高野暖花',
  '高野　暖花',
  '釣部堅登',
  '渡辺菜々子',
  '杉浦一鷹'
)
OR email IN (
  'takeuchiharuta',
  'test'
)
OR name IN (
  'takeuchiharuta',
  'test'
);

-- 無効化されたユーザーを確認
SELECT id, name, email, is_deactivated FROM users WHERE is_deactivated = true;
