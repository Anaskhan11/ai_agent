-- Create webhook_data table for storing captured webhook data
CREATE TABLE IF NOT EXISTS webhook_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  webhook_id VARCHAR(255) NOT NULL,
  data JSON NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_webhook_id (webhook_id),
  INDEX idx_created_at (created_at),
  INDEX idx_processed (processed)
);

-- Add workflow_config column to webhooks table if it doesn't exist
ALTER TABLE webhooks 
ADD COLUMN IF NOT EXISTS workflow_config JSON DEFAULT NULL;

-- Add source column to contacts table if it doesn't exist  
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual';
