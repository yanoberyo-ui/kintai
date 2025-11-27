-- Update password_hint column to support question and answer format
-- Change from TEXT to JSONB to store both question and answer

-- First, migrate existing data if any exists
-- If password_hint is a simple text, convert it to JSON format
UPDATE users 
SET password_hint = jsonb_build_object(
  'question', password_hint,
  'answer', ''
)
WHERE password_hint IS NOT NULL 
  AND password_hint != ''
  AND password_hint::text NOT LIKE '{%';

-- Change column type to JSONB
ALTER TABLE users 
  ALTER COLUMN password_hint TYPE JSONB 
  USING CASE 
    WHEN password_hint IS NULL THEN NULL
    WHEN password_hint::text LIKE '{%' THEN password_hint::jsonb
    ELSE jsonb_build_object('question', password_hint::text, 'answer', '')
  END;

-- Add comment
COMMENT ON COLUMN users.password_hint IS 'Password hint in JSON format: {"question": "質問", "answer": "答え"}. Used for password recovery without email verification.';

