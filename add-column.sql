ALTER TABLE revenues ADD COLUMN IF NOT EXISTS achievement_rate DECIMAL(5, 2);
COMMENT ON COLUMN revenues.achievement_rate IS '達成率（パーセンテージ）';
