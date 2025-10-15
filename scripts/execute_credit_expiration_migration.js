/**
 * Execute Credit Expiration Migration
 * This script migrates the existing credit system to support credit expiration
 */

const fs = require('fs');
const path = require('path');
const pool = require('../config/DBConnection');

async function executeCreditExpirationMigration() {
  let connection;
  
  try {
    console.log('🚀 Starting Credit Expiration Migration...\n');
    
    connection = await pool.getConnection();
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrate_credit_expiration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split SQL statements (simple split by semicolon and newline)
    const statements = migrationSQL
      .split(';\n')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📋 Found ${statements.length} SQL statements to execute\n`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      try {
        console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
        
        // Skip empty statements
        if (!statement || statement.trim() === '') {
          continue;
        }
        
        await connection.execute(statement);
        console.log(`✅ Statement ${i + 1} executed successfully`);
        
      } catch (error) {
        // Some errors are expected (like column already exists)
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
            error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists): ${error.message}`);
        } else {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('\n🎉 Credit Expiration Migration completed successfully!');
    
    // Verify the migration
    console.log('\n🔍 Verifying migration...');
    
    // Check if new columns exist
    const [userCreditsColumns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_credits'
      AND COLUMN_NAME IN ('expired_credits', 'last_expiry_at')
    `);
    
    console.log(`✅ user_credits new columns: ${userCreditsColumns.map(col => col.COLUMN_NAME).join(', ')}`);
    
    // Check if credit_batches table exists
    const [batchesTable] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'credit_batches'
    `);
    
    if (batchesTable.length > 0) {
      console.log('✅ credit_batches table created successfully');
      
      // Check how many batches were migrated
      const [batchCount] = await connection.execute('SELECT COUNT(*) as count FROM credit_batches');
      console.log(`✅ Migrated ${batchCount[0].count} credit batches`);
    } else {
      console.log('❌ credit_batches table not found');
    }
    
    // Check alert types
    const [alertTypes] = await connection.execute(`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'credit_alerts' 
      AND COLUMN_NAME = 'alert_type'
    `);
    
    if (alertTypes.length > 0) {
      const enumValues = alertTypes[0].COLUMN_TYPE;
      if (enumValues.includes('credits_expiring') && enumValues.includes('credits_expired')) {
        console.log('✅ Credit alert types updated successfully');
      } else {
        console.log('⚠️  Credit alert types may not have been updated properly');
      }
    }
    
    console.log('\n🎊 Migration verification completed!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Run the migration
if (require.main === module) {
  executeCreditExpirationMigration()
    .then(() => {
      console.log('\n✨ Credit expiration migration completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration failed:', error);
      process.exit(1);
    });
}

module.exports = executeCreditExpirationMigration;
