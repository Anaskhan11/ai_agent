-- Clinical Study Management Portal Database Schema
-- This script creates the database structure for managing clinical research studies,
-- sites, clinical roles, and patient-study assignments

-- =====================================================
-- CLINICAL ROLES TABLE
-- =====================================================
-- Extends the existing roles system with clinical-specific roles
CREATE TABLE IF NOT EXISTS clinical_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(150) NOT NULL,
  description TEXT,
  permissions JSON COMMENT 'JSON object containing permissions: {"view": [], "add": [], "update": [], "delete": []}',
  assigned_pages JSON COMMENT 'Array of page paths this role can access',
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_role_name (role_name),
  INDEX idx_is_active (is_active),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT 'Clinical roles with dynamic permissions and page access';

-- =====================================================
-- SITES TABLE
-- =====================================================
-- Represents clinical research sites (hospitals, research centers, etc.)
CREATE TABLE IF NOT EXISTS sites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  site_name VARCHAR(200) NOT NULL,
  site_code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique identifier for the site',
  description TEXT,
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  phone VARCHAR(20),
  email VARCHAR(255),
  contact_person VARCHAR(200),
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_site_name (site_name),
  INDEX idx_site_code (site_code),
  INDEX idx_is_active (is_active),
  INDEX idx_created_by (created_by),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT 'Clinical research sites where studies are conducted';

-- =====================================================
-- STUDIES TABLE
-- =====================================================
-- Represents clinical studies conducted at sites
CREATE TABLE IF NOT EXISTS studies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  study_name VARCHAR(200) NOT NULL,
  study_code VARCHAR(50) UNIQUE NOT NULL COMMENT 'Unique study identifier',
  site_id INT NOT NULL,
  description TEXT,
  study_type ENUM('interventional', 'observational', 'registry', 'other') DEFAULT 'interventional',
  phase ENUM('preclinical', 'phase_i', 'phase_ii', 'phase_iii', 'phase_iv', 'post_market') DEFAULT 'phase_i',
  status ENUM('planning', 'recruiting', 'active', 'suspended', 'completed', 'terminated') DEFAULT 'planning',
  start_date DATE,
  end_date DATE,
  target_enrollment INT DEFAULT 0,
  current_enrollment INT DEFAULT 0,
  inclusion_criteria TEXT,
  exclusion_criteria TEXT,
  primary_investigator_id INT COMMENT 'User ID of the principal investigator',
  study_coordinator_id INT COMMENT 'User ID of the study coordinator',
  metadata JSON COMMENT 'Additional study metadata and configuration',
  is_active BOOLEAN DEFAULT TRUE,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_study_name (study_name),
  INDEX idx_study_code (study_code),
  INDEX idx_site_id (site_id),
  INDEX idx_status (status),
  INDEX idx_primary_investigator_id (primary_investigator_id),
  INDEX idx_study_coordinator_id (study_coordinator_id),
  INDEX idx_is_active (is_active),
  INDEX idx_created_by (created_by),
  
  FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE,
  FOREIGN KEY (primary_investigator_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (study_coordinator_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT 'Clinical studies conducted at research sites';

-- =====================================================
-- STUDY_PARTICIPANTS TABLE
-- =====================================================
-- Links patients (contacts) to studies with enrollment tracking
CREATE TABLE IF NOT EXISTS study_participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  study_id INT NOT NULL,
  patient_id INT NOT NULL COMMENT 'References contacts.id (patient)',
  participant_id VARCHAR(50) COMMENT 'Study-specific participant identifier',
  enrollment_date DATE,
  enrollment_status ENUM('screening', 'enrolled', 'completed', 'withdrawn', 'screen_failed') DEFAULT 'screening',
  withdrawal_reason TEXT,
  completion_date DATE,
  notes TEXT,
  metadata JSON COMMENT 'Study-specific participant data',
  is_active BOOLEAN DEFAULT TRUE,
  enrolled_by INT COMMENT 'User who enrolled the participant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_study_id (study_id),
  INDEX idx_patient_id (patient_id),
  INDEX idx_participant_id (participant_id),
  INDEX idx_enrollment_status (enrollment_status),
  INDEX idx_enrollment_date (enrollment_date),
  INDEX idx_enrolled_by (enrolled_by),
  INDEX idx_is_active (is_active),
  
  UNIQUE KEY unique_study_patient (study_id, patient_id),
  
  FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (enrolled_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT 'Patient enrollment and participation in clinical studies';

-- =====================================================
-- STUDY_ASSIGNMENTS TABLE
-- =====================================================
-- Assigns users to studies with specific clinical roles
CREATE TABLE IF NOT EXISTS study_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  study_id INT NOT NULL,
  user_id INT NOT NULL,
  clinical_role_id INT NOT NULL,
  assignment_date DATE DEFAULT (CURRENT_DATE),
  is_active BOOLEAN DEFAULT TRUE,
  assigned_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_study_id (study_id),
  INDEX idx_user_id (user_id),
  INDEX idx_clinical_role_id (clinical_role_id),
  INDEX idx_is_active (is_active),
  INDEX idx_assigned_by (assigned_by),
  
  UNIQUE KEY unique_study_user_role (study_id, user_id, clinical_role_id),
  
  FOREIGN KEY (study_id) REFERENCES studies(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (clinical_role_id) REFERENCES clinical_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT 'Assignment of users to studies with specific clinical roles';

-- =====================================================
-- USER_CLINICAL_ROLES TABLE
-- =====================================================
-- Links users to their clinical roles (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_clinical_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  clinical_role_id INT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  assigned_by INT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  
  INDEX idx_user_id (user_id),
  INDEX idx_clinical_role_id (clinical_role_id),
  INDEX idx_is_active (is_active),
  INDEX idx_assigned_by (assigned_by),
  
  UNIQUE KEY unique_user_clinical_role (user_id, clinical_role_id),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (clinical_role_id) REFERENCES clinical_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
) COMMENT 'Assignment of clinical roles to users';

-- =====================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =====================================================

-- Trigger to update study enrollment count when participants are added/updated
DELIMITER $$
CREATE TRIGGER update_study_enrollment_count
AFTER INSERT ON study_participants
FOR EACH ROW
BEGIN
  UPDATE studies 
  SET current_enrollment = (
    SELECT COUNT(*) 
    FROM study_participants 
    WHERE study_id = NEW.study_id 
    AND enrollment_status = 'enrolled' 
    AND is_active = 1
  )
  WHERE id = NEW.study_id;
END$$

CREATE TRIGGER update_study_enrollment_count_on_update
AFTER UPDATE ON study_participants
FOR EACH ROW
BEGIN
  UPDATE studies 
  SET current_enrollment = (
    SELECT COUNT(*) 
    FROM study_participants 
    WHERE study_id = NEW.study_id 
    AND enrollment_status = 'enrolled' 
    AND is_active = 1
  )
  WHERE id = NEW.study_id;
END$$

CREATE TRIGGER update_study_enrollment_count_on_delete
AFTER DELETE ON study_participants
FOR EACH ROW
BEGIN
  UPDATE studies 
  SET current_enrollment = (
    SELECT COUNT(*) 
    FROM study_participants 
    WHERE study_id = OLD.study_id 
    AND enrollment_status = 'enrolled' 
    AND is_active = 1
  )
  WHERE id = OLD.study_id;
END$$
DELIMITER ;

-- =====================================================
-- VIEWS FOR EASY DATA ACCESS
-- =====================================================

-- View for study overview with site and investigator information
CREATE OR REPLACE VIEW study_overview AS
SELECT 
  s.id,
  s.study_name,
  s.study_code,
  s.description,
  s.study_type,
  s.phase,
  s.status,
  s.start_date,
  s.end_date,
  s.target_enrollment,
  s.current_enrollment,
  ROUND((s.current_enrollment / NULLIF(s.target_enrollment, 0)) * 100, 2) as enrollment_percentage,
  
  -- Site information
  site.site_name,
  site.site_code,
  site.city,
  site.state,
  site.country,
  
  -- Principal Investigator information
  pi.first_name as pi_first_name,
  pi.last_name as pi_last_name,
  pi.email as pi_email,
  
  -- Study Coordinator information
  sc.first_name as coordinator_first_name,
  sc.last_name as coordinator_last_name,
  sc.email as coordinator_email,
  
  s.is_active,
  s.created_at,
  s.updated_at
FROM studies s
LEFT JOIN sites site ON s.site_id = site.id
LEFT JOIN users pi ON s.primary_investigator_id = pi.id
LEFT JOIN users sc ON s.study_coordinator_id = sc.id;

-- View for participant enrollment summary
CREATE OR REPLACE VIEW participant_enrollment_summary AS
SELECT 
  s.id as study_id,
  s.study_name,
  s.study_code,
  COUNT(sp.id) as total_participants,
  SUM(CASE WHEN sp.enrollment_status = 'screening' THEN 1 ELSE 0 END) as screening_count,
  SUM(CASE WHEN sp.enrollment_status = 'enrolled' THEN 1 ELSE 0 END) as enrolled_count,
  SUM(CASE WHEN sp.enrollment_status = 'completed' THEN 1 ELSE 0 END) as completed_count,
  SUM(CASE WHEN sp.enrollment_status = 'withdrawn' THEN 1 ELSE 0 END) as withdrawn_count,
  SUM(CASE WHEN sp.enrollment_status = 'screen_failed' THEN 1 ELSE 0 END) as screen_failed_count
FROM studies s
LEFT JOIN study_participants sp ON s.id = sp.study_id AND sp.is_active = 1
GROUP BY s.id, s.study_name, s.study_code;

COMMIT;

-- Display completion message
SELECT 'Clinical Study Management Schema Created Successfully' as Status;
