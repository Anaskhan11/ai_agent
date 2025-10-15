const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration - using the same config as DBConnection.js
const dbConfig = {
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  port: 3306
};

async function runMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'add_soft_delete_to_lists.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log('🔄 Running migration statements...');
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        await connection.execute(statement);
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('📋 The lists table now supports soft delete functionality');
    console.log('   - Added is_deleted column (BOOLEAN, default FALSE)');
    console.log('   - Added deleted_at column (TIMESTAMP, nullable)');
    console.log('   - Added index on is_deleted for better performance');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
runMigration();
