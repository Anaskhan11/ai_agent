-- Add free trial tracking to users table
-- This helps track which users have already claimed their free $10 trial package

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS has_used_free_trial BOOLEAN DEFAULT FALSE COMMENT 'TRUE if user has already claimed their free $10 trial package',
ADD COLUMN IF NOT EXISTS free_trial_claimed_at DATETIME NULL COMMENT 'When the user claimed their free trial package';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_has_used_free_trial ON users(has_used_free_trial);
CREATE INDEX IF NOT EXISTS idx_free_trial_claimed_at ON users(free_trial_claimed_at);

-- Show current users table structure to verify changes
DESCRIBE users;
