const pool = require('../config/DBConnection');
const fs = require('fs');
const path = require('path');

async function runFreeTrialMigration() {
  console.log('🚀 Running free trial migration...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/add_free_trial_tracking.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.toLowerCase().includes('describe')) {
        console.log(`⏭️ Skipping DESCRIBE statement: ${statement.substring(0, 50)}...`);
        continue;
      }
      
      console.log(`🔄 Executing statement ${i + 1}: ${statement.substring(0, 50)}...`);
      
      try {
        await pool.execute(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME' || error.message.includes('Duplicate column name')) {
          console.log(`⚠️ Column already exists, skipping: ${error.message}`);
        } else if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
          console.log(`⚠️ Index already exists, skipping: ${error.message}`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    // Verify the migration by checking if the columns exist
    console.log('🔍 Verifying migration...');
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ai_agent' 
        AND TABLE_NAME = 'users' 
        AND COLUMN_NAME IN ('has_used_free_trial', 'free_trial_claimed_at')
      ORDER BY COLUMN_NAME
    `);
    
    if (columns.length === 2) {
      console.log('✅ Migration completed successfully!');
      console.log('📋 Added columns:');
      columns.forEach(col => {
        console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'}) - ${col.COLUMN_COMMENT}`);
      });
    } else {
      console.log(`⚠️ Expected 2 columns, found ${columns.length}`);
      console.log('Found columns:', columns);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
runFreeTrialMigration()
  .then(() => {
    console.log('🎉 Free trial migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Free trial migration failed:', error);
    process.exit(1);
  });
