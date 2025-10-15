-- Create webhook_notification_logs table for storing Gmail notification results
CREATE TABLE IF NOT EXISTS webhook_notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  webhook_id VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  user_email VARCHAR(255) NOT NULL,
  success BOOLEAN DEFAULT FALSE,
  message_id VARCHAR(255) NULL,
  provider VARCHAR(100) NULL,
  error_message TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_webhook_id (webhook_id),
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create gmail_tokens table if it doesn't exist (for storing Gmail OAuth tokens)
CREATE TABLE IF NOT EXISTS gmail_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expiry_date TIMESTAMP NULL,
  scope TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_gmail (user_id),
  INDEX idx_user_id (user_id),
  INDEX idx_expiry_date (expiry_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create gmail_watch_history table if it doesn't exist (for tracking Gmail watch status)
CREATE TABLE IF NOT EXISTS gmail_watch_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  history_id VARCHAR(255) NULL,
  expiration VARCHAR(255) NULL,
  status ENUM('active', 'stopped', 'expired') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_expiration (expiration)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create gmail_webhook_triggers table if it doesn't exist (for tracking which emails triggered which webhooks)
CREATE TABLE IF NOT EXISTS gmail_webhook_triggers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message_id VARCHAR(255) NOT NULL,
  webhook_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_trigger (user_id, message_id, webhook_id),
  INDEX idx_user_id (user_id),
  INDEX idx_message_id (message_id),
  INDEX idx_webhook_id (webhook_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create webhook_failures table if it doesn't exist (for tracking webhook delivery failures)
CREATE TABLE IF NOT EXISTS webhook_failures (
  id INT AUTO_INCREMENT PRIMARY KEY,
  webhook_id VARCHAR(255) NOT NULL,
  error_message TEXT NOT NULL,
  payload JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_webhook_id (webhook_id),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
