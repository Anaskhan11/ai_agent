-- Lists and Contacts Database Schema
-- This script creates the proper database structure for lists and contacts management

-- Create lists table
CREATE TABLE IF NOT EXISTS lists (
    id INT AUTO_INCREMENT PRIMARY KEY,
    list_name VARCHAR(255) NOT NULL,
    type ENUM('Marketing', 'Sales', 'Event', 'Customer', 'General') DEFAULT 'General',
    contacts_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    user_id INT NOT NULL,
    list_description TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_list_name (list_name),
    INDEX idx_created_at (created_at),
    INDEX idx_is_deleted (is_deleted)
);

-- Update contacts table structure to match requirements
-- First, let's check if contacts table exists and modify it
ALTER TABLE contacts 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS list_id INT,
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD INDEX IF NOT EXISTS idx_list_id (list_id),
ADD INDEX IF NOT EXISTS idx_user_id (user_id),
ADD INDEX IF NOT EXISTS idx_email (email);

-- Add foreign key constraint if it doesn't exist
-- Note: We'll handle this carefully to avoid errors if constraint already exists
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'contacts' 
     AND CONSTRAINT_NAME = 'fk_contacts_list_id') = 0,
    'ALTER TABLE contacts ADD CONSTRAINT fk_contacts_list_id FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE',
    'SELECT "Foreign key constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create triggers to automatically update contacts_count in lists table
DROP TRIGGER IF EXISTS update_list_count_insert;

CREATE TRIGGER update_list_count_insert
    AFTER INSERT ON contacts
    FOR EACH ROW
    UPDATE lists
    SET contacts_count = (
        SELECT COUNT(*)
        FROM contacts
        WHERE list_id = NEW.list_id
    )
    WHERE id = NEW.list_id;

DROP TRIGGER IF EXISTS update_list_count_delete;

CREATE TRIGGER update_list_count_delete
    AFTER DELETE ON contacts
    FOR EACH ROW
    UPDATE lists
    SET contacts_count = (
        SELECT COUNT(*)
        FROM contacts
        WHERE list_id = OLD.list_id
    )
    WHERE id = OLD.list_id;

-- Update existing contacts_count for all lists
UPDATE lists l 
SET contacts_count = (
    SELECT COUNT(*) 
    FROM contacts c 
    WHERE c.list_id = l.id
);
