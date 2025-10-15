const mysql = require('mysql2/promise');

const dbConfig = {
  host: '37.27.187.4',
  user: 'root',
  password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
  database: 'ai_agent',
  multipleStatements: true
};

async function checkTableStructures() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Check users table structure
    console.log('\n📋 USERS TABLE STRUCTURE:');
    const [usersStructure] = await connection.execute('DESCRIBE users');
    console.table(usersStructure);
    
    // Check clinical_roles table structure
    console.log('\n📋 CLINICAL_ROLES TABLE STRUCTURE:');
    try {
      const [rolesStructure] = await connection.execute('DESCRIBE clinical_roles');
      console.table(rolesStructure);
    } catch (error) {
      console.log('❌ clinical_roles table does not exist');
    }
    
    // Check studies table structure
    console.log('\n📋 STUDIES TABLE STRUCTURE:');
    try {
      const [studiesStructure] = await connection.execute('DESCRIBE studies');
      console.table(studiesStructure);
    } catch (error) {
      console.log('❌ studies table does not exist');
    }
    
    // Check study_assignments table structure
    console.log('\n📋 STUDY_ASSIGNMENTS TABLE STRUCTURE:');
    try {
      const [assignmentsStructure] = await connection.execute('DESCRIBE study_assignments');
      console.table(assignmentsStructure);
    } catch (error) {
      console.log('❌ study_assignments table does not exist');
    }
    
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

checkTableStructures();
