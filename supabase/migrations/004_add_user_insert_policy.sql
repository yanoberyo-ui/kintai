-- Add INSERT policy for users table to allow new user registration
-- This allows authenticated users to insert their own user record during sign-up

CREATE POLICY "Users can insert own data during signup"
  ON users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Add UPDATE policy for users table to allow users to update their own profile
CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Add comments
COMMENT ON POLICY "Users can insert own data during signup" ON users IS
  'Allows users to create their own user record during the sign-up process';

COMMENT ON POLICY "Users can update own data" ON users IS
  'Allows users to update their own profile information';
