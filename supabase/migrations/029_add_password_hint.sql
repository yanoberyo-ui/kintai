-- Add password_hint column to users table
-- This allows users to set a password hint for password recovery without email

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hint TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_password_hint ON users(password_hint) WHERE password_hint IS NOT NULL;

-- Add comment
COMMENT ON COLUMN users.password_hint IS 'Password hint for password recovery. Users can set a hint (e.g., "childhood car") and use it along with email to reset password without email verification.';

