-- Add achievement_rate column to revenues table
ALTER TABLE revenues ADD COLUMN IF NOT EXISTS achievement_rate DECIMAL(5, 2);

-- Add comment
COMMENT ON COLUMN revenues.achievement_rate IS '達成率（パーセンテージ）';
