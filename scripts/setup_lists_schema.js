const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  multipleStatements: true
});

async function setupListsSchema() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await pool.getConnection();
    
    // Read the SQL file
    const sqlFilePath = path.join(__dirname, 'lists_schema.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Executing schema setup...');
    
    // Split SQL content by statements (handling DELIMITER changes)
    const statements = sqlContent.split(/(?:DELIMITER\s+\/\/|DELIMITER\s+;|\n\/\/\n|\n;\n)/);
    
    for (let statement of statements) {
      statement = statement.trim();
      if (statement && !statement.startsWith('--') && !statement.startsWith('DELIMITER')) {
        try {
          await connection.query(statement);
          console.log('✓ Executed statement successfully');
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME' || error.code === 'ER_DUP_KEYNAME') {
            console.log('⚠ Field/Key already exists, skipping...');
          } else {
            console.error('Error executing statement:', error.message);
          }
        }
      }
    }
    
    console.log('✅ Database schema setup completed successfully!');
    
    // Verify the tables exist
    const [tables] = await connection.query("SHOW TABLES LIKE 'lists'");
    if (tables.length > 0) {
      console.log('✓ Lists table created successfully');
    }
    
    const [contactsDesc] = await connection.query("DESCRIBE contacts");
    console.log('✓ Contacts table structure:');
    contactsDesc.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });
    
  } catch (error) {
    console.error('❌ Error setting up database schema:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Run the setup
setupListsSchema();
