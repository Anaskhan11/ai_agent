-- Support System Database Schema
-- This script creates the support tickets table following the application's established patterns

-- Create support_tickets table
CREATE TABLE IF NOT EXISTS support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  ticket_id VARCHAR(255) UNIQUE NOT NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category ENUM('technical', 'billing', 'feature_request', 'bug_report', 'general') DEFAULT 'general',
  priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
  status ENUM('open', 'in_progress', 'waiting_response', 'resolved', 'closed') DEFAULT 'open',
  assigned_to INT UNSIGNED NULL,
  attachments JSON,
  tags JSON,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP NULL,
  closed_at TIMESTAMP NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_status (status),
  INDEX idx_priority (priority),
  INDEX idx_category (category),
  INDEX idx_assigned_to (assigned_to),
  INDEX idx_created_at (created_at),
  INDEX idx_updated_at (updated_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
);

-- Create support_ticket_messages table for ticket conversations
CREATE TABLE IF NOT EXISTS support_ticket_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  message_id VARCHAR(255) UNIQUE NOT NULL,
  message TEXT NOT NULL,
  message_type ENUM('user_message', 'admin_response', 'system_message', 'internal_note') DEFAULT 'user_message',
  attachments JSON,
  is_internal BOOLEAN DEFAULT FALSE,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_user_id (user_id),
  INDEX idx_message_id (message_id),
  INDEX idx_message_type (message_type),
  INDEX idx_is_internal (is_internal),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create support_categories table for dynamic category management
CREATE TABLE IF NOT EXISTS support_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6B7280',
  icon VARCHAR(50) DEFAULT 'HelpCircle',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category_id (category_id),
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order)
);

-- Insert default support categories
INSERT INTO support_categories (category_id, name, description, color, icon, sort_order) VALUES
('technical', 'Technical Support', 'Technical issues and troubleshooting', '#EF4444', 'Settings', 1),
('billing', 'Billing & Payments', 'Billing questions and payment issues', '#10B981', 'CreditCard', 2),
('feature_request', 'Feature Request', 'Suggestions for new features', '#3B82F6', 'Lightbulb', 3),
('bug_report', 'Bug Report', 'Report bugs and issues', '#F59E0B', 'Bug', 4),
('general', 'General Inquiry', 'General questions and support', '#6B7280', 'MessageCircle', 5);

-- Create support_ticket_history table for tracking status changes
CREATE TABLE IF NOT EXISTS support_ticket_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  action ENUM('created', 'status_changed', 'priority_changed', 'assigned', 'unassigned', 'category_changed', 'resolved', 'closed', 'reopened') NOT NULL,
  old_value VARCHAR(255),
  new_value VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ticket_id (ticket_id),
  INDEX idx_user_id (user_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
