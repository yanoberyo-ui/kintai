-- 勤務時間が0またはnullだが、clock_inとclock_outが存在するレコードを修正
-- このスクリプトは既存のデータを修正します

UPDATE attendances
SET 
  total_work_minutes = GREATEST(
    EXTRACT(EPOCH FROM (clock_out - clock_in)) / 60 - COALESCE(break_minutes_used, 0),
    0
  )::INTEGER,
  updated_at = NOW()
WHERE 
  status = 'completed'
  AND clock_in IS NOT NULL
  AND clock_out IS NOT NULL
  AND (total_work_minutes IS NULL OR total_work_minutes = 0)
  AND clock_out > clock_in; -- 退勤時刻が出勤時刻より後であることを確認

-- 修正されたレコード数を確認
SELECT 
  COUNT(*) as fixed_records,
  SUM(total_work_minutes) as total_minutes_fixed
FROM attendances
WHERE 
  status = 'completed'
  AND clock_in IS NOT NULL
  AND clock_out IS NOT NULL
  AND total_work_minutes > 0
  AND updated_at >= NOW() - INTERVAL '1 minute'; -- 直近1分以内に更新されたレコード

