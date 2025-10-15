const mysql = require('mysql2/promise');

// Database configuration - using the same config as DBConnection.js
const dbConfig = {
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  port: 3306
};

async function runDirectMigration() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Check current table structure
    console.log('\n📋 Current table structure:');
    const [currentColumns] = await connection.query("DESCRIBE lists");
    currentColumns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Add is_deleted column
    console.log('\n🔄 Adding is_deleted column...');
    try {
      await connection.query("ALTER TABLE lists ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE");
      console.log('✅ is_deleted column added successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ is_deleted column already exists');
      } else {
        throw error;
      }
    }

    // Add deleted_at column
    console.log('\n🔄 Adding deleted_at column...');
    try {
      await connection.query("ALTER TABLE lists ADD COLUMN deleted_at TIMESTAMP NULL");
      console.log('✅ deleted_at column added successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('ℹ️ deleted_at column already exists');
      } else {
        throw error;
      }
    }

    // Add index on is_deleted
    console.log('\n🔄 Adding index on is_deleted...');
    try {
      await connection.query("ALTER TABLE lists ADD INDEX idx_is_deleted (is_deleted)");
      console.log('✅ Index on is_deleted added successfully');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('ℹ️ Index on is_deleted already exists');
      } else {
        throw error;
      }
    }

    // Update existing records
    console.log('\n🔄 Updating existing records...');
    const [updateResult] = await connection.query("UPDATE lists SET is_deleted = FALSE WHERE is_deleted IS NULL");
    console.log(`✅ Updated ${updateResult.affectedRows} existing records`);

    // Show final table structure
    console.log('\n📋 Final table structure:');
    const [finalColumns] = await connection.query("DESCRIBE lists");
    finalColumns.forEach(col => {
      console.log(`   - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${col.Default !== null ? `DEFAULT ${col.Default}` : ''}`);
    });

    // Show indexes
    console.log('\n📋 Table indexes:');
    const [indexes] = await connection.query("SHOW INDEX FROM lists");
    indexes.forEach(idx => {
      console.log(`   - ${idx.Key_name}: ${idx.Column_name}`);
    });

    console.log('\n🎉 Migration completed successfully!');
    console.log('✅ The lists table now supports soft delete functionality');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
runDirectMigration();
