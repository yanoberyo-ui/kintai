-- Add slack_user_id column to users table for Slack integration
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_user_id TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_slack_user_id ON users(slack_user_id);

-- Add comment
COMMENT ON COLUMN users.slack_user_id IS 'Slack user ID for slash command integration';
