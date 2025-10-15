/**
 * Fix Credit Expiration Migration
 * This script fixes the credit expiration migration by running individual SQL statements
 */

const pool = require('../config/DBConnection');

async function fixCreditExpirationMigration() {
  let connection;
  
  try {
    console.log('🔧 Starting Credit Expiration Migration Fix...\n');
    
    connection = await pool.getConnection();
    console.log('✅ Database connection established');
    
    // Step 1: Add new columns to user_credits table
    console.log('\n📋 Step 1: Adding new columns to user_credits table...');
    
    try {
      await connection.execute(`
        ALTER TABLE user_credits 
        ADD COLUMN expired_credits DECIMAL(15,2) DEFAULT 0.00 COMMENT 'Credits that have expired'
      `);
      console.log('✅ Added expired_credits column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  expired_credits column already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await connection.execute(`
        ALTER TABLE user_credits 
        ADD COLUMN last_expiry_at TIMESTAMP NULL COMMENT 'Last time credits expired'
      `);
      console.log('✅ Added last_expiry_at column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  last_expiry_at column already exists');
      } else {
        throw error;
      }
    }
    
    try {
      await connection.execute(`
        ALTER TABLE user_credits 
        ADD INDEX idx_last_expiry (last_expiry_at)
      `);
      console.log('✅ Added index for last_expiry_at');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠️  Index idx_last_expiry already exists');
      } else {
        throw error;
      }
    }
    
    // Step 2: Update the generated column
    console.log('\n📋 Step 2: Updating available_credits generated column...');
    
    try {
      await connection.execute(`
        ALTER TABLE user_credits 
        DROP COLUMN available_credits
      `);
      console.log('✅ Dropped old available_credits column');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠️  available_credits column already dropped or doesn\'t exist');
      } else {
        throw error;
      }
    }
    
    try {
      await connection.execute(`
        ALTER TABLE user_credits 
        ADD COLUMN available_credits DECIMAL(15,2) GENERATED ALWAYS AS (total_credits - used_credits - expired_credits) STORED
      `);
      console.log('✅ Added new available_credits generated column');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠️  New available_credits column already exists');
      } else {
        throw error;
      }
    }
    
    // Step 3: Create credit_batches table
    console.log('\n📋 Step 3: Creating credit_batches table...');
    
    try {
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS credit_batches (
          id INT AUTO_INCREMENT PRIMARY KEY,
          batch_id VARCHAR(255) UNIQUE NOT NULL,
          user_id INT UNSIGNED NOT NULL,
          credits_purchased DECIMAL(15,2) NOT NULL,
          credits_remaining DECIMAL(15,2) NOT NULL,
          credits_used DECIMAL(15,2) DEFAULT 0.00,
          purchase_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expiry_date TIMESTAMP NOT NULL,
          is_expired BOOLEAN DEFAULT FALSE,
          expired_at TIMESTAMP NULL,
          package_id VARCHAR(255) NULL,
          payment_reference VARCHAR(255) NULL,
          batch_type ENUM('purchase', 'bonus', 'adjustment', 'refund') DEFAULT 'purchase',
          metadata JSON,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_expiry_date (expiry_date),
          INDEX idx_is_expired (is_expired),
          INDEX idx_credits_remaining (credits_remaining),
          INDEX idx_purchase_date (purchase_date),
          INDEX idx_batch_type (batch_type)
        )
      `);
      console.log('✅ Created credit_batches table');
    } catch (error) {
      console.log('⚠️  credit_batches table creation issue:', error.message);
    }
    
    // Step 4: Update credit_alerts table
    console.log('\n📋 Step 4: Updating credit_alerts table...');
    
    try {
      await connection.execute(`
        ALTER TABLE credit_alerts 
        MODIFY COLUMN alert_type ENUM('low_credits', 'no_credits', 'purchase_success', 'purchase_failed', 'usage_spike', 'credits_expiring', 'credits_expired') NOT NULL
      `);
      console.log('✅ Updated credit_alerts alert_type enum');
    } catch (error) {
      console.log('⚠️  credit_alerts update issue:', error.message);
    }
    
    // Step 5: Migrate existing credits to batches
    console.log('\n📋 Step 5: Migrating existing credits to batches...');
    
    try {
      const [existingCredits] = await connection.execute(`
        SELECT uc.user_id, uc.total_credits, uc.used_credits, uc.last_purchase_at, uc.created_at
        FROM user_credits uc
        WHERE uc.total_credits > 0
        AND NOT EXISTS (SELECT 1 FROM credit_batches cb WHERE cb.user_id = uc.user_id)
      `);
      
      console.log(`📊 Found ${existingCredits.length} users with existing credits to migrate`);
      
      for (const user of existingCredits) {
        const batchId = `MIGRATION_${user.user_id}_${Date.now()}`;
        const purchaseDate = user.last_purchase_at || user.created_at;
        const expiryDate = new Date(purchaseDate);
        expiryDate.setDate(expiryDate.getDate() + 30);
        
        await connection.execute(`
          INSERT INTO credit_batches (
            batch_id, user_id, credits_purchased, credits_remaining, credits_used,
            purchase_date, expiry_date, batch_type, metadata
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'purchase', ?)
        `, [
          batchId,
          user.user_id,
          user.total_credits,
          user.total_credits - user.used_credits,
          user.used_credits,
          purchaseDate,
          expiryDate,
          JSON.stringify({ migration: true, original_total: user.total_credits })
        ]);
      }
      
      console.log(`✅ Migrated ${existingCredits.length} user credit records to batches`);
    } catch (error) {
      console.log('⚠️  Credit migration issue:', error.message);
    }
    
    // Step 6: Verify migration
    console.log('\n📋 Step 6: Verifying migration...');
    
    // Check columns
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_credits'
      AND COLUMN_NAME IN ('expired_credits', 'last_expiry_at')
    `);
    
    console.log(`✅ user_credits has ${columns.length}/2 new expiration columns`);
    
    // Check credit_batches table
    const [tables] = await connection.execute(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'credit_batches'
    `);
    
    if (tables.length > 0) {
      const [batchCount] = await connection.execute('SELECT COUNT(*) as count FROM credit_batches');
      console.log(`✅ credit_batches table exists with ${batchCount[0].count} records`);
    }
    
    console.log('\n🎉 Credit Expiration Migration Fix completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Migration fix failed:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Run the migration fix
if (require.main === module) {
  fixCreditExpirationMigration()
    .then(() => {
      console.log('\n✨ Migration fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Migration fix failed:', error);
      process.exit(1);
    });
}

module.exports = fixCreditExpirationMigration;
