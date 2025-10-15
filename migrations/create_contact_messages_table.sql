-- Create contact_messages table for storing SMS message history
CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  contact_id VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  content TEXT NOT NULL,
  sender ENUM('user', 'contact') NOT NULL,
  timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('sending', 'sent', 'delivered', 'failed', 'read') NOT NULL DEFAULT 'sent',
  message_id VARCHAR(255) NULL,
  twilio_sid VARCHAR(255) NULL,
  phone_number VARCHAR(50) NULL,
  from_phone_number VARCHAR(50) NULL,
  metadata JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_contact_id (contact_id),
  INDEX idx_user_id (user_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_status (status),
  INDEX idx_sender (sender),
  INDEX idx_twilio_sid (twilio_sid),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes for better query performance
CREATE INDEX idx_contact_user_timestamp ON contact_messages (contact_id, user_id, timestamp);
CREATE INDEX idx_user_timestamp ON contact_messages (user_id, timestamp DESC);

-- Insert sample data for testing (optional)
-- INSERT INTO contact_messages (contact_id, user_id, content, sender, timestamp, status, phone_number) VALUES
-- ('sample-contact-1', 1, 'Hello! This is a test message.', 'user', NOW(), 'sent', '+1234567890'),
-- ('sample-contact-1', 1, 'Hi there! Thanks for reaching out.', 'contact', NOW(), 'delivered', '+1234567890');
