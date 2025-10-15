-- Add auto-subscription features to the database

-- 1. Add columns to users table for stored payment methods and auto-subscription preferences
-- Note: These will fail if columns already exist, but that's okay
ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN default_payment_method_id VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN auto_subscription_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN auto_subscription_package_id VARCHAR(50) NULL;
ALTER TABLE users ADD COLUMN free_trial_claimed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN free_trial_claimed_at DATETIME NULL;

-- 2. Create auto_subscription_settings table for detailed subscription preferences
CREATE TABLE IF NOT EXISTS auto_subscription_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  target_package_id VARCHAR(50) NOT NULL,
  trigger_threshold INT DEFAULT 0, -- Credits remaining to trigger auto-purchase
  max_monthly_purchases INT DEFAULT 1, -- Limit auto-purchases per month
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (target_package_id) REFERENCES credit_packages(package_id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_subscription (user_id)
);

-- 3. Create auto_subscription_history table to track automatic purchases
CREATE TABLE IF NOT EXISTS auto_subscription_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  package_id VARCHAR(50) NOT NULL,
  credits_purchased INT NOT NULL,
  amount_cents INT NOT NULL,
  stripe_payment_intent_id VARCHAR(255) NULL,
  status ENUM('pending', 'succeeded', 'failed', 'cancelled') DEFAULT 'pending',
  triggered_by ENUM('low_credits', 'expiration', 'manual') DEFAULT 'low_credits',
  triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  error_message TEXT NULL,
  metadata JSON NULL,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES credit_packages(package_id) ON DELETE SET NULL,
  INDEX idx_user_status (user_id, status),
  INDEX idx_triggered_at (triggered_at)
);

-- 4. Add indexes for better performance
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX idx_users_auto_subscription ON users(auto_subscription_enabled);
CREATE INDEX idx_users_free_trial ON users(free_trial_claimed);

-- 5. Update existing users to have free_trial_claimed = FALSE if NULL
UPDATE users SET free_trial_claimed = FALSE WHERE free_trial_claimed IS NULL;
