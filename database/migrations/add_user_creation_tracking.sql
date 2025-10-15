-- Add columns to track how users were created
-- This helps distinguish between self-registered users (need email verification) 
-- and admin-created users (don't need email verification)

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS created_by_admin BOOLEAN DEFAULT FALSE COMMENT 'TRUE if user was created by admin, FALSE if self-registered',
ADD COLUMN IF NOT EXISTS requires_email_verification BOOLEAN DEFAULT TRUE COMMENT 'TRUE if user needs email verification to login';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_requires_email_verification ON users(requires_email_verification);
CREATE INDEX IF NOT EXISTS idx_created_by_admin ON users(created_by_admin);

-- Update existing users who were likely created by admins
-- (users with no OTP records are likely admin-created)
UPDATE users u
LEFT JOIN email_verification_otps otp ON u.email = otp.email
SET 
  created_by_admin = TRUE,
  requires_email_verification = FALSE,
  email_verified = TRUE,
  email_verified_at = COALESCE(email_verified_at, NOW()),
  updated_at = NOW()
WHERE otp.email IS NULL 
  AND u.email_verified = FALSE 
  AND u.is_active = TRUE;
