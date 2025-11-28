-- Add last_clock_out column to attendances table
-- This column stores the re-clock-in time (when user clocks in again after clocking out)
-- This allows accurate work duration calculation by measuring from re-clock-in time instead of original clock_in

ALTER TABLE attendances ADD COLUMN IF NOT EXISTS last_clock_out TIMESTAMPTZ;

-- Add comment
COMMENT ON COLUMN attendances.last_clock_out IS 'Re-clock-in time. When user re-clocks in after clocking out, this stores the time they re-clocked in. Used to calculate work duration accurately by excluding time between clock_out and re-clock_in.';
