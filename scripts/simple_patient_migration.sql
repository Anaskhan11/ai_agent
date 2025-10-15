-- Simple Enhanced Patient Management Schema for Alcohol Study
-- This script adds comprehensive patient fields to the existing contacts table
-- All new fields default to NULL to maintain compatibility with existing data

-- Patient Lead Information
ALTER TABLE contacts ADD COLUMN patient_lead_source VARCHAR(255) NULL COMMENT 'Source of the patient lead (e.g., website, referral, advertisement)';
ALTER TABLE contacts ADD COLUMN banned BOOLEAN DEFAULT FALSE COMMENT 'Whether the patient is banned from the study';
ALTER TABLE contacts ADD COLUMN patient_lead_owner VARCHAR(255) NULL COMMENT 'Person responsible for this patient lead';
ALTER TABLE contacts ADD COLUMN patient_lead_name VARCHAR(255) NULL COMMENT 'Name assigned to this patient lead';

-- Contact Information (additional phone)
ALTER TABLE contacts ADD COLUMN phone2 VARCHAR(20) NULL COMMENT 'Secondary phone number';

-- Demographics
ALTER TABLE contacts ADD COLUMN date_of_birth DATE NULL COMMENT 'Patient date of birth';
ALTER TABLE contacts ADD COLUMN age INT NULL COMMENT 'Patient age (can be calculated from DOB)';
ALTER TABLE contacts ADD COLUMN height VARCHAR(20) NULL COMMENT 'Patient height (e.g., 5\'10", 170cm)';
ALTER TABLE contacts ADD COLUMN weight_lbs DECIMAL(5,2) NULL COMMENT 'Patient weight in pounds';

-- Medical Information
ALTER TABLE contacts ADD COLUMN habits TEXT NULL COMMENT 'Patient habits (smoking, drinking, exercise, etc.)';
ALTER TABLE contacts ADD COLUMN medications TEXT NULL COMMENT 'Current medications and dosages';
ALTER TABLE contacts ADD COLUMN diagnosis TEXT NULL COMMENT 'Medical diagnoses and conditions';
ALTER TABLE contacts ADD COLUMN surgeries TEXT NULL COMMENT 'Previous surgeries and procedures';

-- Status and Tracking
ALTER TABLE contacts ADD COLUMN status ENUM('new', 'contacted', 'screening', 'qualified', 'enrolled', 'completed', 'withdrawn', 'disqualified') DEFAULT 'new' COMMENT 'Current patient status in the study';
ALTER TABLE contacts ADD COLUMN qualified_status ENUM('pending', 'qualified', 'not_qualified', 'needs_review') DEFAULT 'pending' COMMENT 'Qualification status for the study';
ALTER TABLE contacts ADD COLUMN dnq BOOLEAN DEFAULT FALSE COMMENT 'Do Not Qualify - patient does not meet study criteria';
ALTER TABLE contacts ADD COLUMN not_interested_reasons TEXT NULL COMMENT 'Reasons why patient is not interested in participating';

-- Audit Fields
ALTER TABLE contacts ADD COLUMN created_by INT NULL COMMENT 'User ID who created this patient record';
ALTER TABLE contacts ADD COLUMN modified_by INT NULL COMMENT 'User ID who last modified this patient record';
ALTER TABLE contacts ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Last update timestamp';

-- Add indexes for better query performance
ALTER TABLE contacts ADD INDEX idx_patient_lead_source (patient_lead_source);
ALTER TABLE contacts ADD INDEX idx_banned (banned);
ALTER TABLE contacts ADD INDEX idx_patient_lead_owner (patient_lead_owner);
ALTER TABLE contacts ADD INDEX idx_date_of_birth (date_of_birth);
ALTER TABLE contacts ADD INDEX idx_age (age);
ALTER TABLE contacts ADD INDEX idx_status (status);
ALTER TABLE contacts ADD INDEX idx_qualified_status (qualified_status);
ALTER TABLE contacts ADD INDEX idx_dnq (dnq);
ALTER TABLE contacts ADD INDEX idx_created_by (created_by);
ALTER TABLE contacts ADD INDEX idx_modified_by (modified_by);
ALTER TABLE contacts ADD INDEX idx_updated_at (updated_at);

-- Add composite indexes for common query patterns
ALTER TABLE contacts ADD INDEX idx_status_qualified (status, qualified_status);
ALTER TABLE contacts ADD INDEX idx_study_eligibility (banned, dnq, status);

-- Update existing records to set default values for audit fields
UPDATE contacts 
SET 
    created_by = NULL,
    modified_by = NULL,
    updated_at = COALESCE(createdAt, CURRENT_TIMESTAMP)
WHERE created_by IS NULL;

-- Display summary of changes
SELECT 'Enhanced Patient Schema Migration Completed Successfully' as Status;
SELECT COUNT(*) as Total_Patients FROM contacts;
