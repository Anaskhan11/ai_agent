-- Workflows table for storing workflow metadata and references to Vapi workflows
CREATE TABLE IF NOT EXISTS workflows (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  workflow_id VARCHAR(255) UNIQUE NOT NULL, -- Vapi workflow ID
  org_id VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('active', 'inactive', 'draft', 'archived') DEFAULT 'active',
  metadata JSON, -- Store additional workflow metadata like node count, last modified, etc.
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workflow executions table for tracking workflow test runs and calls
CREATE TABLE IF NOT EXISTS workflow_executions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  call_id VARCHAR(255), -- Vapi call ID
  execution_type ENUM('test', 'production') DEFAULT 'test',
  status ENUM('queued', 'ringing', 'in-progress', 'completed', 'failed', 'cancelled') DEFAULT 'queued',
  phone_number VARCHAR(50),
  duration INT DEFAULT 0, -- Duration in seconds
  cost DECIMAL(10, 4) DEFAULT 0.0000,
  metadata JSON, -- Store execution details, variables extracted, etc.
  started_at TIMESTAMP NULL,
  ended_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_user_id (user_id),
  INDEX idx_call_id (call_id),
  INDEX idx_status (status),
  INDEX idx_execution_type (execution_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Workflow templates table for storing predefined workflow templates
CREATE TABLE IF NOT EXISTS workflow_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'General',
  template_data JSON NOT NULL, -- Store the complete workflow structure
  is_public BOOLEAN DEFAULT true,
  created_by INT,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_template_id (template_id),
  INDEX idx_category (category),
  INDEX idx_is_public (is_public),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Workflow variables table for storing extracted variables from workflow executions
CREATE TABLE IF NOT EXISTS workflow_variables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  execution_id INT NOT NULL,
  workflow_id VARCHAR(255) NOT NULL,
  variable_name VARCHAR(255) NOT NULL,
  variable_type ENUM('string', 'number', 'boolean', 'integer', 'object', 'array') DEFAULT 'string',
  variable_value TEXT,
  extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_execution_id (execution_id),
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_variable_name (variable_name),
  INDEX idx_extracted_at (extracted_at),
  FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE CASCADE,
  FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

-- Workflow analytics table for tracking workflow performance
CREATE TABLE IF NOT EXISTS workflow_analytics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  workflow_id VARCHAR(255) NOT NULL,
  user_id INT NOT NULL,
  date DATE NOT NULL,
  total_executions INT DEFAULT 0,
  successful_executions INT DEFAULT 0,
  failed_executions INT DEFAULT 0,
  average_duration DECIMAL(10, 2) DEFAULT 0.00,
  total_cost DECIMAL(10, 4) DEFAULT 0.0000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_workflow_date (workflow_id, date),
  INDEX idx_workflow_id (workflow_id),
  INDEX idx_user_id (user_id),
  INDEX idx_date (date),
  FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insert default workflow templates
INSERT INTO workflow_templates (template_id, name, description, category, template_data, is_public) VALUES
('basic-greeting', 'Basic Greeting Workflow', 'Simple greeting workflow with information collection', 'Basic', 
 JSON_OBJECT(
   'nodes', JSON_ARRAY(
     JSON_OBJECT(
       'type', 'conversation',
       'name', 'greeting',
       'isStart', true,
       'prompt', 'Greet the user and ask how you can help them today.',
       'firstMessage', 'Hello! How can I assist you today?'
     )
   ),
   'edges', JSON_ARRAY()
 ), true),

('appointment-scheduling', 'Appointment Scheduling', 'Complete appointment booking workflow', 'Business',
 JSON_OBJECT(
   'nodes', JSON_ARRAY(
     JSON_OBJECT(
       'type', 'conversation',
       'name', 'greeting',
       'isStart', true,
       'prompt', 'Greet the user and ask about scheduling an appointment.',
       'firstMessage', 'Hello! I can help you schedule an appointment. What service are you interested in?'
     )
   ),
   'edges', JSON_ARRAY()
 ), true),

('customer-support', 'Customer Support', 'Customer support workflow with escalation', 'Support',
 JSON_OBJECT(
   'nodes', JSON_ARRAY(
     JSON_OBJECT(
       'type', 'conversation',
       'name', 'support-greeting',
       'isStart', true,
       'prompt', 'Greet the customer and ask about their issue.',
       'firstMessage', 'Hello! I\'m here to help with any questions or issues you may have.'
     )
   ),
   'edges', JSON_ARRAY()
 ), true)

ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description),
  template_data = VALUES(template_data),
  updated_at = CURRENT_TIMESTAMP;
