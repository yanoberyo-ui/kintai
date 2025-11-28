-- Add last_clock_out column to attendances table
-- This column stores the previous clock_out time when re-clocking in
-- This allows accurate work duration calculation when re-clocking in after clocking out

ALTER TABLE attendances ADD COLUMN IF NOT EXISTS last_clock_out TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN attendances.last_clock_out IS 'Previous clock_out time when re-clocking in. Used to calculate work duration accurately by excluding time between clock_out and re-clock_in.';

