-- Create Audit Logs table for comprehensive tracking of all CRUD operations
-- This table will store detailed information about every database operation

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  user_email VARCHAR(255),
  user_name VARCHAR(255),
  operation_type ENUM('CREATE', 'UPDATE', 'DELETE', 'READ') NOT NULL,
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(255),
  old_values JSON,
  new_values JSON,
  changed_fields JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  request_method VARCHAR(10),
  request_url VARCHAR(500),
  request_body JSON,
  response_status INT,
  execution_time_ms INT,
  error_message TEXT,
  metadata JSON,
  session_id VARCHAR(255),
  transaction_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes for optimal query performance
  INDEX idx_user_id (user_id),
  INDEX idx_operation_type (operation_type),
  INDEX idx_table_name (table_name),
  INDEX idx_record_id (record_id),
  INDEX idx_created_at (created_at),
  INDEX idx_user_email (user_email),
  INDEX idx_table_operation (table_name, operation_type),
  INDEX idx_user_table (user_id, table_name),
  INDEX idx_date_table (created_at, table_name)
);
