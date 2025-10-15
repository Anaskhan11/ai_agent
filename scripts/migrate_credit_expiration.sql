-- Migration script to add credit expiration functionality
-- This script adds expiration tracking to the existing credit system

-- Add new columns to user_credits table
ALTER TABLE user_credits 
ADD COLUMN expired_credits DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Credits that have expired',
ADD COLUMN last_expiry_at TIMESTAMP NULL COMMENT 'Last time credits expired',
ADD INDEX idx_last_expiry (last_expiry_at);

-- Update the generated column to include expired credits
ALTER TABLE user_credits 
DROP COLUMN available_credits;

ALTER TABLE user_credits 
ADD COLUMN available_credits DECIMAL(15,2) GENERATED ALWAYS AS (total_credits - used_credits - expired_credits) STORED;

-- Create credit_batches table for tracking individual credit purchases with expiration
CREATE TABLE IF NOT EXISTS credit_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  credits_purchased DECIMAL(15,2) NOT NULL, -- Original credits in this batch
  credits_remaining DECIMAL(15,2) NOT NULL, -- Credits still available in this batch
  credits_used DECIMAL(15,2) DEFAULT 0.00, -- Credits used from this batch
  purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expiry_date TIMESTAMP NOT NULL, -- When this batch expires (30 days from purchase)
  is_expired BOOLEAN DEFAULT FALSE,
  expired_at TIMESTAMP NULL, -- When this batch was marked as expired
  package_id VARCHAR(255) NULL, -- Reference to credit package
  payment_reference VARCHAR(255) NULL, -- Reference to payment (stripe_payment_intent_id)
  batch_type ENUM('purchase', 'bonus', 'adjustment', 'refund') DEFAULT 'purchase',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_expiry_date (expiry_date),
  INDEX idx_is_expired (is_expired),
  INDEX idx_credits_remaining (credits_remaining),
  INDEX idx_purchase_date (purchase_date),
  INDEX idx_batch_type (batch_type)
);

-- Migrate existing credit purchases to credit_batches
-- This creates batches for existing credits with 30-day expiry from last purchase
INSERT INTO credit_batches (
  batch_id, 
  user_id, 
  credits_purchased, 
  credits_remaining, 
  credits_used,
  purchase_date, 
  expiry_date, 
  package_id,
  payment_reference,
  batch_type,
  metadata
)
SELECT 
  CONCAT('MIGRATION_', UUID()) as batch_id,
  uc.user_id,
  uc.total_credits as credits_purchased,
  uc.available_credits as credits_remaining,
  uc.used_credits as credits_used,
  COALESCE(uc.last_purchase_at, uc.created_at) as purchase_date,
  DATE_ADD(COALESCE(uc.last_purchase_at, uc.created_at), INTERVAL 30 DAY) as expiry_date,
  sp.package_id,
  sp.stripe_payment_intent_id as payment_reference,
  'purchase' as batch_type,
  JSON_OBJECT(
    'migration', true,
    'original_total_credits', uc.total_credits,
    'original_used_credits', uc.used_credits
  ) as metadata
FROM user_credits uc
LEFT JOIN (
  SELECT 
    user_id, 
    package_id, 
    stripe_payment_intent_id,
    ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
  FROM stripe_payments 
  WHERE status = 'succeeded'
) sp ON uc.user_id = sp.user_id AND sp.rn = 1
WHERE uc.total_credits > 0;

-- Add expiry alert type to credit_alerts table if not exists
ALTER TABLE credit_alerts 
MODIFY COLUMN alert_type ENUM('low_credits', 'no_credits', 'purchase_success', 'purchase_failed', 'usage_spike', 'credits_expiring', 'credits_expired') NOT NULL;
