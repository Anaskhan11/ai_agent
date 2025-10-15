const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const dbConfig = {
  host: '37.27.187.4',
  user: 'root',
  password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
  database: 'ai_agent',
  multipleStatements: true
};

async function runSchema() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Read the schema file
    const schemaPath = path.join(__dirname, 'clinical_study_management_schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('🔄 Executing clinical study management schema...');
    
    // Split the SQL into individual statements and execute them
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await connection.execute(statement);
          console.log('✅ Executed statement successfully');
        } catch (error) {
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || 
              error.code === 'ER_DUP_KEYNAME' ||
              error.message.includes('already exists')) {
            console.log('ℹ️  Table/Index already exists, skipping...');
          } else {
            console.error('❌ Error executing statement:', error.message);
            console.log('Statement:', statement.substring(0, 100) + '...');
          }
        }
      }
    }
    
    console.log('🎉 Schema execution completed!');
    
    // Test the study_assignments table
    console.log('🔄 Testing study_assignments table...');
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM study_assignments');
    console.log('✅ study_assignments table exists with', rows[0].count, 'records');
    
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

runSchema();
