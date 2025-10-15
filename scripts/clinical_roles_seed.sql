-- Clinical Roles Seed Data
-- This script populates the clinical_roles table with common clinical research roles

-- Insert default clinical roles
INSERT INTO clinical_roles (role_name, display_name, description, permissions, assigned_pages) VALUES

-- Principal Investigator
('principal_investigator', 'Principal Investigator', 'Lead researcher responsible for the overall conduct of the clinical study', 
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'participants', 'sites', 'reports', 'dashboard'),
  'add', JSON_ARRAY('participants', 'study_notes'),
  'update', JSON_ARRAY('studies', 'participants', 'study_notes'),
  'delete', JSON_ARRAY('study_notes')
),
JSON_ARRAY('/dashboard', '/studies', '/participants', '/sites', '/reports', '/study-management')),

-- Study Coordinator
('study_coordinator', 'Study Coordinator', 'Manages day-to-day study operations and participant recruitment',
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'participants', 'recruitment', 'dashboard'),
  'add', JSON_ARRAY('participants', 'recruitment_logs'),
  'update', JSON_ARRAY('participants', 'recruitment_logs'),
  'delete', JSON_ARRAY('recruitment_logs')
),
JSON_ARRAY('/dashboard', '/studies', '/participants', '/recruitment', '/study-management')),

-- Site Manager
('site_manager', 'Site Manager', 'Oversees multiple studies at a clinical site',
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'participants', 'sites', 'staff', 'dashboard'),
  'add', JSON_ARRAY('studies', 'participants', 'staff_assignments'),
  'update', JSON_ARRAY('studies', 'participants', 'sites', 'staff_assignments'),
  'delete', JSON_ARRAY('staff_assignments')
),
JSON_ARRAY('/dashboard', '/studies', '/participants', '/sites', '/staff', '/study-management')),

-- Clinical Research Associate (CRA)
('clinical_research_associate', 'Clinical Research Associate', 'Monitors study conduct and ensures compliance',
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'participants', 'compliance', 'reports', 'dashboard'),
  'add', JSON_ARRAY('monitoring_reports', 'compliance_notes'),
  'update', JSON_ARRAY('monitoring_reports', 'compliance_notes'),
  'delete', JSON_ARRAY('monitoring_reports', 'compliance_notes')
),
JSON_ARRAY('/dashboard', '/studies', '/participants', '/compliance', '/reports', '/monitoring')),

-- Data Entry Specialist
('data_entry_specialist', 'Data Entry Specialist', 'Responsible for entering and managing study data',
JSON_OBJECT(
  'view', JSON_ARRAY('participants', 'data_entry', 'dashboard'),
  'add', JSON_ARRAY('participant_data', 'case_report_forms'),
  'update', JSON_ARRAY('participant_data', 'case_report_forms'),
  'delete', JSON_ARRAY()
),
JSON_ARRAY('/dashboard', '/participants', '/data-entry', '/case-report-forms')),

-- Recruiter
('recruiter', 'Recruiter', 'Focuses on patient recruitment and screening',
JSON_OBJECT(
  'view', JSON_ARRAY('recruitment', 'participants', 'screening', 'dashboard'),
  'add', JSON_ARRAY('participants', 'screening_logs', 'recruitment_activities'),
  'update', JSON_ARRAY('participants', 'screening_logs', 'recruitment_activities'),
  'delete', JSON_ARRAY('recruitment_activities')
),
JSON_ARRAY('/dashboard', '/recruitment', '/participants', '/screening', '/patients')),

-- Regulatory Affairs Specialist
('regulatory_affairs', 'Regulatory Affairs Specialist', 'Manages regulatory compliance and submissions',
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'compliance', 'regulatory', 'reports', 'dashboard'),
  'add', JSON_ARRAY('regulatory_submissions', 'compliance_reports'),
  'update', JSON_ARRAY('regulatory_submissions', 'compliance_reports'),
  'delete', JSON_ARRAY('regulatory_submissions')
),
JSON_ARRAY('/dashboard', '/studies', '/compliance', '/regulatory', '/reports')),

-- Quality Assurance Specialist
('quality_assurance', 'Quality Assurance Specialist', 'Ensures study quality and data integrity',
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'participants', 'quality', 'reports', 'dashboard'),
  'add', JSON_ARRAY('quality_reports', 'audit_findings'),
  'update', JSON_ARRAY('quality_reports', 'audit_findings'),
  'delete', JSON_ARRAY('quality_reports', 'audit_findings')
),
JSON_ARRAY('/dashboard', '/studies', '/participants', '/quality', '/reports', '/audits')),

-- Biostatistician
('biostatistician', 'Biostatistician', 'Analyzes study data and generates statistical reports',
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'participants', 'statistics', 'reports', 'dashboard'),
  'add', JSON_ARRAY('statistical_reports', 'data_analysis'),
  'update', JSON_ARRAY('statistical_reports', 'data_analysis'),
  'delete', JSON_ARRAY('statistical_reports')
),
JSON_ARRAY('/dashboard', '/studies', '/participants', '/statistics', '/reports', '/analytics')),

-- Study Monitor
('study_monitor', 'Study Monitor', 'Monitors study progress and participant safety',
JSON_OBJECT(
  'view', JSON_ARRAY('studies', 'participants', 'monitoring', 'safety', 'dashboard'),
  'add', JSON_ARRAY('monitoring_visits', 'safety_reports'),
  'update', JSON_ARRAY('monitoring_visits', 'safety_reports'),
  'delete', JSON_ARRAY('monitoring_visits')
),
JSON_ARRAY('/dashboard', '/studies', '/participants', '/monitoring', '/safety')),

-- Research Nurse
('research_nurse', 'Research Nurse', 'Provides clinical care and conducts study procedures',
JSON_OBJECT(
  'view', JSON_ARRAY('participants', 'procedures', 'safety', 'dashboard'),
  'add', JSON_ARRAY('procedure_notes', 'safety_observations'),
  'update', JSON_ARRAY('participants', 'procedure_notes', 'safety_observations'),
  'delete', JSON_ARRAY('procedure_notes')
),
JSON_ARRAY('/dashboard', '/participants', '/procedures', '/safety', '/clinical-care')),

-- Lab Coordinator
('lab_coordinator', 'Lab Coordinator', 'Manages laboratory samples and test results',
JSON_OBJECT(
  'view', JSON_ARRAY('participants', 'laboratory', 'samples', 'dashboard'),
  'add', JSON_ARRAY('lab_results', 'sample_tracking'),
  'update', JSON_ARRAY('lab_results', 'sample_tracking'),
  'delete', JSON_ARRAY('sample_tracking')
),
JSON_ARRAY('/dashboard', '/participants', '/laboratory', '/samples', '/lab-results'))

ON DUPLICATE KEY UPDATE
  display_name = VALUES(display_name),
  description = VALUES(description),
  permissions = VALUES(permissions),
  assigned_pages = VALUES(assigned_pages),
  updated_at = CURRENT_TIMESTAMP;

-- Insert some sample sites
INSERT INTO sites (site_name, site_code, description, address, city, state, country, phone, email, contact_person, created_by) VALUES
('Metropolitan General Hospital', 'MGH001', 'Large metropolitan hospital with comprehensive clinical research facilities', '123 Medical Center Drive', 'New York', 'NY', 'USA', '+1-555-0123', 'research@mgh.org', 'Dr. Sarah Johnson', 1),
('University Medical Center', 'UMC002', 'Academic medical center affiliated with state university', '456 University Avenue', 'Los Angeles', 'CA', 'USA', '+1-555-0456', 'clinicalresearch@umc.edu', 'Dr. Michael Chen', 1),
('Regional Research Institute', 'RRI003', 'Specialized clinical research facility', '789 Research Parkway', 'Chicago', 'IL', 'USA', '+1-555-0789', 'studies@rri.org', 'Dr. Emily Rodriguez', 1)
ON DUPLICATE KEY UPDATE
  site_name = VALUES(site_name),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

-- Insert sample studies
INSERT INTO studies (study_name, study_code, site_id, description, study_type, phase, status, start_date, target_enrollment, inclusion_criteria, exclusion_criteria, primary_investigator_id, created_by) VALUES
('Alcohol Dependency Treatment Study', 'ADTS2024', 1, 'Phase II study evaluating novel treatment for alcohol dependency', 'interventional', 'phase_ii', 'recruiting', '2024-01-15', 100, 'Adults 18-65 with diagnosed alcohol dependency, willing to participate', 'Pregnant women, severe liver disease, concurrent substance abuse', 1, 1),
('Cardiovascular Risk Assessment', 'CVRA2024', 2, 'Observational study on cardiovascular risk factors', 'observational', 'post_market', 'active', '2024-02-01', 200, 'Adults over 40 with at least one cardiovascular risk factor', 'History of heart surgery, current participation in other studies', 1, 1),
('Diabetes Management Registry', 'DMR2024', 3, 'Long-term registry study for diabetes management outcomes', 'registry', 'post_market', 'recruiting', '2024-03-01', 500, 'Diagnosed Type 2 diabetes, age 21-80', 'Type 1 diabetes, pregnancy, terminal illness', 1, 1)
ON DUPLICATE KEY UPDATE
  study_name = VALUES(study_name),
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

-- Display completion message
SELECT 'Clinical Roles and Sample Data Seeded Successfully' as Status;
SELECT COUNT(*) as 'Clinical Roles Created' FROM clinical_roles;
SELECT COUNT(*) as 'Sites Created' FROM sites;
SELECT COUNT(*) as 'Studies Created' FROM studies;
