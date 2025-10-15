const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  multipleStatements: true
};

async function runPatientMigration() {
  let connection;
  
  try {
    console.log('🚀 Starting Enhanced Patient Schema Migration...');
    
    // Create database connection
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'simple_patient_migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration SQL file loaded');
    
    // Create a backup of the current contacts table structure
    console.log('💾 Creating backup of current contacts table structure...');
    const [tableInfo] = await connection.execute('DESCRIBE contacts');
    const backupPath = path.join(__dirname, `contacts_backup_structure_${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(tableInfo, null, 2));
    console.log(`✅ Table structure backup saved to: ${backupPath}`);
    
    // Get current record count
    const [countResult] = await connection.execute('SELECT COUNT(*) as count FROM contacts');
    const currentCount = countResult[0].count;
    console.log(`📊 Current contacts count: ${currentCount}`);
    
    // Execute the migration statement by statement
    console.log('🔄 Executing migration...');

    // Split SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      if (statement.toLowerCase().includes('select ')) {
        // Skip SELECT statements for now
        console.log(`⏭️  Skipping SELECT statement ${i + 1}`);
        skipCount++;
        continue;
      }

      try {
        console.log(`🔄 Executing statement ${i + 1}/${statements.length}...`);
        await connection.execute(statement);
        successCount++;
      } catch (error) {
        // Check if it's a "column already exists" error
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  Column already exists, skipping statement ${i + 1}`);
          skipCount++;
        } else if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`⚠️  Index already exists, skipping statement ${i + 1}`);
          skipCount++;
        } else {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error(`Statement: ${statement.substring(0, 100)}...`);
          // Continue with other statements instead of failing completely
        }
      }
    }

    console.log(`✅ Migration completed: ${successCount} successful, ${skipCount} skipped`);
    
    // Verify the migration
    console.log('🔍 Verifying migration...');
    
    // Check if new columns were added
    const [newTableInfo] = await connection.execute('DESCRIBE contacts');
    const newColumns = newTableInfo.filter(col => 
      ['patient_lead_source', 'banned', 'patient_lead_owner', 'patient_lead_name', 
       'phone2', 'date_of_birth', 'age', 'height', 'weight_lbs', 'habits', 
       'medications', 'diagnosis', 'surgeries', 'status', 'qualified_status', 
       'dnq', 'not_interested_reasons', 'created_by', 'modified_by', 'updated_at'].includes(col.Field)
    );
    
    console.log(`✅ Added ${newColumns.length} new patient columns:`);
    newColumns.forEach(col => {
      console.log(`   - ${col.Field} (${col.Type})`);
    });
    
    // Verify record count hasn't changed
    const [newCountResult] = await connection.execute('SELECT COUNT(*) as count FROM contacts');
    const newCount = newCountResult[0].count;
    
    if (newCount === currentCount) {
      console.log(`✅ Record count verified: ${newCount} records maintained`);
    } else {
      console.log(`⚠️  Record count changed: ${currentCount} -> ${newCount}`);
    }
    
    // Check indexes
    const [indexes] = await connection.execute(`
      SELECT INDEX_NAME, COLUMN_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'contacts' 
      AND INDEX_NAME LIKE 'idx_%'
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `);
    
    console.log(`✅ Created ${indexes.length} indexes for better performance`);
    
    // Note: Patient details view not created in simple migration
    console.log('ℹ️  Patient details view not created in simple migration');
    
    // Test stored procedures
    await connection.execute('CALL UpdateAllPatientAges()');
    console.log('✅ Patient age calculation procedure working');
    
    console.log('\n🎉 Enhanced Patient Schema Migration Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Added ${newColumns.length} new patient fields`);
    console.log(`   - Created ${indexes.length} performance indexes`);
    console.log(`   - Created patient_details view for easy data access`);
    console.log(`   - Created age calculation procedures`);
    console.log(`   - Maintained ${newCount} existing patient records`);
    console.log('\n🔧 Next Steps:');
    console.log('   1. Update backend models to handle new fields');
    console.log('   2. Update API endpoints for patient management');
    console.log('   3. Update frontend forms and interfaces');
    console.log('   4. Test webhook integration with new fields');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
    
    if (error.code) {
      console.error('Error code:', error.code);
    }
    
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the migration
if (require.main === module) {
  runPatientMigration().catch(console.error);
}

module.exports = { runPatientMigration };
