-- Credit System Database Schema
-- Professional credit-based billing system similar to VAPI's approach
-- This schema supports credit packages, transactions, usage tracking, and Stripe integration

-- Credit Packages table - Define available credit packages for purchase
CREATE TABLE IF NOT EXISTS credit_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  credits_amount INT NOT NULL, -- Number of credits in this package
  price_cents INT NOT NULL, -- Price in cents (for Stripe)
  currency VARCHAR(3) DEFAULT 'USD',
  stripe_price_id VARCHAR(255), -- Stripe Price ID for this package
  is_active BOOLEAN DEFAULT TRUE,
  is_popular BOOLEAN DEFAULT FALSE, -- Mark popular packages
  bonus_credits INT DEFAULT 0, -- Bonus credits for promotional packages
  valid_for_days INT DEFAULT NULL, -- Package validity (NULL = no expiry)
  metadata JSON, -- Additional package metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_package_id (package_id),
  INDEX idx_is_active (is_active),
  INDEX idx_price_cents (price_cents)
);

-- User Credits table - Track current credit balance for each user
CREATE TABLE IF NOT EXISTS user_credits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  total_credits DECIMAL(15,2) DEFAULT 0.00, -- Total credits available
  used_credits DECIMAL(15,2) DEFAULT 0.00, -- Credits consumed
  expired_credits DECIMAL(15,2) DEFAULT 0.00, -- Credits that have expired
  available_credits DECIMAL(15,2) GENERATED ALWAYS AS (total_credits - used_credits - expired_credits) STORED,
  last_purchase_at TIMESTAMP NULL,
  last_usage_at TIMESTAMP NULL,
  last_expiry_at TIMESTAMP NULL, -- Last time credits expired
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_credits (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_available_credits (available_credits),
  INDEX idx_last_usage_at (last_usage_at),
  INDEX idx_last_expiry (last_expiry_at)
);

-- Credit Batches table - Track individual credit purchases with expiration dates
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

-- Credit Transactions table - Track all credit-related transactions
CREATE TABLE IF NOT EXISTS credit_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  type ENUM('purchase', 'usage', 'refund', 'bonus', 'adjustment', 'expiry') NOT NULL,
  amount DECIMAL(15,2) NOT NULL, -- Positive for credits added, negative for credits used
  balance_before DECIMAL(15,2) NOT NULL,
  balance_after DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_type VARCHAR(100), -- 'stripe_payment', 'vapi_call', 'admin_adjustment', etc.
  reference_id VARCHAR(255), -- ID of the related record (payment_intent_id, call_id, etc.)
  package_id VARCHAR(255) NULL, -- Reference to credit package if applicable
  stripe_payment_intent_id VARCHAR(255) NULL,
  metadata JSON, -- Additional transaction metadata
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES credit_packages(package_id) ON DELETE SET NULL,
  INDEX idx_transaction_id (transaction_id),
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_reference_type (reference_type),
  INDEX idx_reference_id (reference_id),
  INDEX idx_stripe_payment_intent_id (stripe_payment_intent_id),
  INDEX idx_processed_at (processed_at)
);

-- Usage Tracking table - Detailed tracking of credit consumption
CREATE TABLE IF NOT EXISTS usage_tracking (
  id INT AUTO_INCREMENT PRIMARY KEY,
  usage_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  operation_type VARCHAR(100) NOT NULL, -- 'vapi_call', 'message', 'file_upload', etc.
  operation_id VARCHAR(255), -- ID of the specific operation
  credits_consumed DECIMAL(15,2) NOT NULL,
  unit_cost DECIMAL(15,4) NOT NULL, -- Cost per unit (e.g., per minute, per message)
  units_consumed DECIMAL(15,2) NOT NULL, -- Number of units consumed
  unit_type VARCHAR(50) NOT NULL, -- 'minutes', 'messages', 'characters', 'calls', etc.
  operation_details JSON, -- Detailed information about the operation
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  duration_seconds INT NULL, -- For time-based operations
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  error_message TEXT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_usage_id (usage_id),
  INDEX idx_user_id (user_id),
  INDEX idx_operation_type (operation_type),
  INDEX idx_operation_id (operation_id),
  INDEX idx_status (status),
  INDEX idx_started_at (started_at),
  INDEX idx_completed_at (completed_at),
  INDEX idx_created_at (created_at)
);

-- Credit Pricing table - Define credit costs for different operations
CREATE TABLE IF NOT EXISTS credit_pricing (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operation_type VARCHAR(100) NOT NULL,
  unit_type VARCHAR(50) NOT NULL, -- 'per_minute', 'per_call', 'per_message', etc.
  credits_per_unit DECIMAL(15,4) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  effective_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  effective_until TIMESTAMP NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_operation_unit (operation_type, unit_type, effective_from),
  INDEX idx_operation_type (operation_type),
  INDEX idx_is_active (is_active),
  INDEX idx_effective_from (effective_from),
  INDEX idx_effective_until (effective_until)
);

-- Stripe Payments table - Track Stripe payment information
CREATE TABLE IF NOT EXISTS stripe_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255),
  package_id VARCHAR(255),
  amount_cents INT NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status ENUM('pending', 'succeeded', 'failed', 'canceled', 'refunded') NOT NULL,
  credits_purchased INT NOT NULL,
  credits_allocated BOOLEAN DEFAULT FALSE,
  payment_method_id VARCHAR(255),
  receipt_url VARCHAR(500),
  failure_reason TEXT,
  refund_amount_cents INT DEFAULT 0,
  metadata JSON,
  stripe_created_at TIMESTAMP NULL,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (package_id) REFERENCES credit_packages(package_id) ON DELETE SET NULL,
  INDEX idx_payment_id (payment_id),
  INDEX idx_user_id (user_id),
  INDEX idx_stripe_payment_intent_id (stripe_payment_intent_id),
  INDEX idx_stripe_customer_id (stripe_customer_id),
  INDEX idx_status (status),
  INDEX idx_credits_allocated (credits_allocated),
  INDEX idx_created_at (created_at)
);

-- Credit Alerts table - Manage credit-related notifications and alerts
CREATE TABLE IF NOT EXISTS credit_alerts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  alert_id VARCHAR(255) UNIQUE NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  alert_type ENUM('low_credits', 'no_credits', 'purchase_success', 'purchase_failed', 'usage_spike') NOT NULL,
  threshold_value DECIMAL(15,2), -- Credit threshold that triggered the alert
  current_value DECIMAL(15,2), -- Current credit balance when alert was triggered
  message TEXT NOT NULL,
  is_sent BOOLEAN DEFAULT FALSE,
  sent_at TIMESTAMP NULL,
  email_sent BOOLEAN DEFAULT FALSE,
  push_sent BOOLEAN DEFAULT FALSE,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_alert_id (alert_id),
  INDEX idx_user_id (user_id),
  INDEX idx_alert_type (alert_type),
  INDEX idx_is_sent (is_sent),
  INDEX idx_created_at (created_at)
);

-- Insert default credit packages
INSERT INTO credit_packages (package_id, name, description, credits_amount, price_cents, is_popular, bonus_credits) VALUES
('starter', 'Starter Pack', 'Perfect for getting started with voice AI', 100, 1000, FALSE, 0),
('professional', 'Professional Pack', 'Great for regular users', 500, 4500, TRUE, 50),
('business', 'Business Pack', 'Ideal for growing businesses', 1000, 8000, FALSE, 150),
('enterprise', 'Enterprise Pack', 'For high-volume usage', 2500, 18000, FALSE, 500),
('premium', 'Premium Pack', 'Maximum value package', 5000, 32000, FALSE, 1000);

-- Insert default credit pricing for operations
INSERT INTO credit_pricing (operation_type, unit_type, credits_per_unit, description) VALUES
('vapi_call', 'per_minute', 0.50, 'VAPI voice call per minute'),
('vapi_call', 'per_call', 1.00, 'VAPI voice call initiation fee'),
('message', 'per_message', 0.10, 'Text message processing'),
('file_upload', 'per_mb', 0.25, 'File upload and processing per MB'),
('workflow_execution', 'per_execution', 0.75, 'Workflow execution'),
('assistant_query', 'per_query', 0.05, 'AI assistant query processing'),
('transcription', 'per_minute', 0.30, 'Audio transcription per minute'),
('tts', 'per_character', 0.001, 'Text-to-speech per character');
