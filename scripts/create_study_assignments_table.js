const mysql = require('mysql2/promise');

const dbConfig = {
  host: '37.27.187.4',
  user: 'root',
  password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
  database: 'ai_agent',
  multipleStatements: true
};

async function createStudyAssignmentsTable() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Create study_assignments table
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS study_assignments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        study_id INT NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        clinical_role_id INT NOT NULL,
        assignment_date DATE DEFAULT (CURRENT_DATE),
        is_active BOOLEAN DEFAULT TRUE,
        assigned_by INT UNSIGNED,
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
      ) COMMENT 'Assignment of users to studies with specific clinical roles'
    `;
    
    console.log('🔄 Creating study_assignments table...');
    await connection.execute(createTableSQL);
    console.log('✅ study_assignments table created successfully');
    
    // Test the table
    console.log('🔄 Testing study_assignments table...');
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM study_assignments');
    console.log('✅ study_assignments table exists with', rows[0].count, 'records');
    
    // Check if clinical_roles table exists
    console.log('🔄 Checking clinical_roles table...');
    try {
      const [roleRows] = await connection.execute('SELECT COUNT(*) as count FROM clinical_roles');
      console.log('✅ clinical_roles table exists with', roleRows[0].count, 'records');
    } catch (error) {
      console.log('⚠️  clinical_roles table does not exist, creating it...');
      
      const createClinicalRolesSQL = `
        CREATE TABLE IF NOT EXISTS clinical_roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL UNIQUE,
          display_name VARCHAR(150) NOT NULL,
          description TEXT,
          permissions JSON COMMENT 'JSON object containing permissions',
          hierarchy_level INT DEFAULT 1,
          is_active BOOLEAN DEFAULT TRUE,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_name (name),
          INDEX idx_is_active (is_active),
          INDEX idx_hierarchy_level (hierarchy_level),
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) COMMENT 'Clinical roles with permissions and hierarchy'
      `;
      
      await connection.execute(createClinicalRolesSQL);
      console.log('✅ clinical_roles table created successfully');
    }
    
    // Check if studies table exists
    console.log('🔄 Checking studies table...');
    try {
      const [studyRows] = await connection.execute('SELECT COUNT(*) as count FROM studies');
      console.log('✅ studies table exists with', studyRows[0].count, 'records');
    } catch (error) {
      console.log('⚠️  studies table does not exist, creating it...');
      
      const createStudiesSQL = `
        CREATE TABLE IF NOT EXISTS studies (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(200) NOT NULL,
          study_id VARCHAR(50) UNIQUE NOT NULL,
          protocol_number VARCHAR(100),
          description TEXT,
          study_type ENUM('interventional', 'observational', 'registry', 'other') DEFAULT 'interventional',
          phase ENUM('preclinical', 'phase_1', 'phase_2', 'phase_3', 'phase_4', 'post_market') DEFAULT 'phase_1',
          status ENUM('planning', 'recruiting', 'not_yet_recruiting', 'active', 'suspended', 'completed', 'terminated') DEFAULT 'planning',
          start_date DATE,
          end_date DATE,
          target_enrollment INT DEFAULT 0,
          current_enrollment INT DEFAULT 0,
          principal_investigator_id INT,
          site_id INT,
          is_active BOOLEAN DEFAULT TRUE,
          created_by INT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          
          INDEX idx_name (name),
          INDEX idx_study_id (study_id),
          INDEX idx_status (status),
          INDEX idx_principal_investigator_id (principal_investigator_id),
          INDEX idx_site_id (site_id),
          INDEX idx_is_active (is_active),
          
          FOREIGN KEY (principal_investigator_id) REFERENCES users(id) ON DELETE SET NULL,
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
        ) COMMENT 'Clinical studies'
      `;
      
      await connection.execute(createStudiesSQL);
      console.log('✅ studies table created successfully');
    }
    
    console.log('🎉 All tables are ready!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

createStudyAssignmentsTable();
