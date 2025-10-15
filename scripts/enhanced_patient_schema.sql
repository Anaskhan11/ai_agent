-- Enhanced Patient Management Schema for Alcohol Study
-- This script adds comprehensive patient fields to the existing contacts table
-- All new fields default to NULL to maintain compatibility with existing data

-- First, let's add all the new patient-specific columns to the contacts table
-- We'll use individual ALTER statements to handle existing columns gracefully

-- Patient Lead Information
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'patient_lead_source') = 0,
    'ALTER TABLE contacts ADD COLUMN patient_lead_source VARCHAR(255) NULL COMMENT "Source of the patient lead"',
    'SELECT "patient_lead_source column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'banned') = 0,
    'ALTER TABLE contacts ADD COLUMN banned BOOLEAN DEFAULT FALSE COMMENT "Whether the patient is banned from the study"',
    'SELECT "banned column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'patient_lead_owner') = 0,
    'ALTER TABLE contacts ADD COLUMN patient_lead_owner VARCHAR(255) NULL COMMENT "Person responsible for this patient lead"',
    'SELECT "patient_lead_owner column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'patient_lead_name') = 0,
    'ALTER TABLE contacts ADD COLUMN patient_lead_name VARCHAR(255) NULL COMMENT "Name assigned to this patient lead"',
    'SELECT "patient_lead_name column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Contact Information (additional phone)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'phone2') = 0,
    'ALTER TABLE contacts ADD COLUMN phone2 VARCHAR(20) NULL COMMENT "Secondary phone number"',
    'SELECT "phone2 column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Demographics
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'date_of_birth') = 0,
    'ALTER TABLE contacts ADD COLUMN date_of_birth DATE NULL COMMENT "Patient date of birth"',
    'SELECT "date_of_birth column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'age') = 0,
    'ALTER TABLE contacts ADD COLUMN age INT NULL COMMENT "Patient age"',
    'SELECT "age column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'height') = 0,
    'ALTER TABLE contacts ADD COLUMN height VARCHAR(20) NULL COMMENT "Patient height"',
    'SELECT "height column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'weight_lbs') = 0,
    'ALTER TABLE contacts ADD COLUMN weight_lbs DECIMAL(5,2) NULL COMMENT "Patient weight in pounds"',
    'SELECT "weight_lbs column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Medical Information
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'habits') = 0,
    'ALTER TABLE contacts ADD COLUMN habits TEXT NULL COMMENT "Patient habits"',
    'SELECT "habits column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'medications') = 0,
    'ALTER TABLE contacts ADD COLUMN medications TEXT NULL COMMENT "Current medications and dosages"',
    'SELECT "medications column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'diagnosis') = 0,
    'ALTER TABLE contacts ADD COLUMN diagnosis TEXT NULL COMMENT "Medical diagnoses and conditions"',
    'SELECT "diagnosis column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'surgeries') = 0,
    'ALTER TABLE contacts ADD COLUMN surgeries TEXT NULL COMMENT "Previous surgeries and procedures"',
    'SELECT "surgeries column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Status and Tracking
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'status') = 0,
    'ALTER TABLE contacts ADD COLUMN status ENUM("new", "contacted", "screening", "qualified", "enrolled", "completed", "withdrawn", "disqualified") DEFAULT "new" COMMENT "Current patient status in the study"',
    'SELECT "status column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'qualified_status') = 0,
    'ALTER TABLE contacts ADD COLUMN qualified_status ENUM("pending", "qualified", "not_qualified", "needs_review") DEFAULT "pending" COMMENT "Qualification status for the study"',
    'SELECT "qualified_status column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'dnq') = 0,
    'ALTER TABLE contacts ADD COLUMN dnq BOOLEAN DEFAULT FALSE COMMENT "Do Not Qualify - patient does not meet study criteria"',
    'SELECT "dnq column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'not_interested_reasons') = 0,
    'ALTER TABLE contacts ADD COLUMN not_interested_reasons TEXT NULL COMMENT "Reasons why patient is not interested in participating"',
    'SELECT "not_interested_reasons column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Audit Fields
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'created_by') = 0,
    'ALTER TABLE contacts ADD COLUMN created_by INT NULL COMMENT "User ID who created this patient record"',
    'SELECT "created_by column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'modified_by') = 0,
    'ALTER TABLE contacts ADD COLUMN modified_by INT NULL COMMENT "User ID who last modified this patient record"',
    'SELECT "modified_by column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE contacts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT "Last update timestamp"',
    'SELECT "updated_at column already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Create foreign key constraints for audit fields (assuming users table exists)
-- Note: We'll handle this carefully to avoid errors if constraints already exist
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'contacts' 
     AND CONSTRAINT_NAME = 'fk_contacts_created_by') = 0,
    'ALTER TABLE contacts ADD CONSTRAINT fk_contacts_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "Created by foreign key constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'contacts' 
     AND CONSTRAINT_NAME = 'fk_contacts_modified_by') = 0,
    'ALTER TABLE contacts ADD CONSTRAINT fk_contacts_modified_by FOREIGN KEY (modified_by) REFERENCES users(id) ON DELETE SET NULL',
    'SELECT "Modified by foreign key constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Create a view for easy patient data access with user information
CREATE OR REPLACE VIEW patient_details AS
SELECT 
    c.*,
    l.list_name,
    l.type as list_type,
    creator.email as created_by_email,
    creator.name as created_by_name,
    modifier.email as modified_by_email,
    modifier.name as modified_by_name
FROM contacts c
LEFT JOIN lists l ON c.listId = l.id
LEFT JOIN users creator ON c.created_by = creator.id
LEFT JOIN users modifier ON c.modified_by = modifier.id;

-- Create triggers to automatically update the modified_by and updated_at fields
DROP TRIGGER IF EXISTS contacts_update_audit;

DELIMITER $$
CREATE TRIGGER contacts_update_audit
    BEFORE UPDATE ON contacts
    FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
    -- Note: modified_by should be set by the application, not the trigger
END$$
DELIMITER ;

-- Create a stored procedure for calculating age from date of birth
DROP PROCEDURE IF EXISTS UpdatePatientAge;

DELIMITER $$
CREATE PROCEDURE UpdatePatientAge(IN patient_id INT)
BEGIN
    UPDATE contacts 
    SET age = TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())
    WHERE id = patient_id AND date_of_birth IS NOT NULL;
END$$
DELIMITER ;

-- Create a stored procedure to update all patient ages
DROP PROCEDURE IF EXISTS UpdateAllPatientAges;

DELIMITER $$
CREATE PROCEDURE UpdateAllPatientAges()
BEGIN
    UPDATE contacts 
    SET age = TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())
    WHERE date_of_birth IS NOT NULL;
END$$
DELIMITER ;

-- Update existing records to set default values for audit fields
-- This will set created_by to NULL for existing records (can be updated manually later)
UPDATE contacts 
SET 
    created_by = NULL,
    modified_by = NULL,
    updated_at = COALESCE(createdAt, CURRENT_TIMESTAMP)
WHERE created_by IS NULL;

-- Calculate age for existing patients who have date_of_birth
CALL UpdateAllPatientAges();

-- Add indexes for better query performance (with existence checks)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND INDEX_NAME = 'idx_patient_lead_source') = 0,
    'ALTER TABLE contacts ADD INDEX idx_patient_lead_source (patient_lead_source)',
    'SELECT "idx_patient_lead_source already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND INDEX_NAME = 'idx_banned') = 0,
    'ALTER TABLE contacts ADD INDEX idx_banned (banned)',
    'SELECT "idx_banned already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND INDEX_NAME = 'idx_status') = 0,
    'ALTER TABLE contacts ADD INDEX idx_status (status)',
    'SELECT "idx_status already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND INDEX_NAME = 'idx_qualified_status') = 0,
    'ALTER TABLE contacts ADD INDEX idx_qualified_status (qualified_status)',
    'SELECT "idx_qualified_status already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND INDEX_NAME = 'idx_dnq') = 0,
    'ALTER TABLE contacts ADD INDEX idx_dnq (dnq)',
    'SELECT "idx_dnq already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND INDEX_NAME = 'idx_date_of_birth') = 0,
    'ALTER TABLE contacts ADD INDEX idx_date_of_birth (date_of_birth)',
    'SELECT "idx_date_of_birth already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'contacts'
     AND INDEX_NAME = 'idx_age') = 0,
    'ALTER TABLE contacts ADD INDEX idx_age (age)',
    'SELECT "idx_age already exists"'
));
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

COMMIT;

-- Display summary of changes
SELECT 'Enhanced Patient Schema Migration Completed Successfully' as Status;
SELECT COUNT(*) as Total_Patients FROM contacts;
SELECT status, COUNT(*) as Count FROM contacts GROUP BY status;
SELECT qualified_status, COUNT(*) as Count FROM contacts GROUP BY qualified_status;
