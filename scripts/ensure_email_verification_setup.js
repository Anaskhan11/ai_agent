const pool = require('../config/DBConnection');
const fs = require('fs');
const path = require('path');

async function ensureEmailVerificationSetup() {
  console.log('🔧 Ensuring email verification setup...');
  
  const connection = await pool.getConnection();
  
  try {
    // Check current table structure
    console.log('📊 Checking current users table structure...');
    const [columns] = await connection.execute('DESCRIBE users');
    
    console.log('Current users table columns:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default !== null ? `default: ${col.Default}` : ''}`);
    });
    
    // Check if email_verified column exists
    const emailVerifiedExists = columns.some(col => col.Field === 'email_verified');
    const emailVerifiedAtExists = columns.some(col => col.Field === 'email_verified_at');
    
    console.log(`\n📋 Column status:`);
    console.log(`  - email_verified: ${emailVerifiedExists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`  - email_verified_at: ${emailVerifiedAtExists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    // Add missing columns
    if (!emailVerifiedExists) {
      console.log('\n🔧 Adding email_verified column...');
      await connection.execute('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE');
      console.log('✅ email_verified column added');
    }
    
    if (!emailVerifiedAtExists) {
      console.log('\n🔧 Adding email_verified_at column...');
      await connection.execute('ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL');
      console.log('✅ email_verified_at column added');
    }
    
    if (emailVerifiedExists && emailVerifiedAtExists) {
      console.log('\n✅ All required columns already exist');
    }
    
    // Show final table structure
    console.log('\n📊 Final users table structure:');
    const [finalColumns] = await connection.execute('DESCRIBE users');
    finalColumns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default !== null ? `default: ${col.Default}` : ''}`);
    });
    
    // Test the updateEmailVerificationById function
    console.log('\n🧪 Testing updateEmailVerificationById function...');
    
    // Find a test user (or create one temporarily)
    const [testUsers] = await connection.execute('SELECT id, email FROM users LIMIT 1');
    
    if (testUsers.length > 0) {
      const testUserId = testUsers[0].id;
      console.log(`Testing with user ID: ${testUserId}`);
      
      // Test the update function
      const [updateResult] = await connection.execute(
        'UPDATE users SET email_verified = ?, email_verified_at = NOW() WHERE id = ?',
        [true, testUserId]
      );
      
      console.log(`✅ Update test successful. Affected rows: ${updateResult.affectedRows}`);
      
      // Verify the update
      const [verifyResult] = await connection.execute(
        'SELECT email_verified, email_verified_at FROM users WHERE id = ?',
        [testUserId]
      );
      
      console.log('✅ Verification result:', verifyResult[0]);
    } else {
      console.log('ℹ️  No users found for testing');
    }
    
  } catch (error) {
    console.error('❌ Error during setup:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    throw error;
  } finally {
    connection.release();
  }
}

// Run if called directly
if (require.main === module) {
  ensureEmailVerificationSetup()
    .then(() => {
      console.log('\n🎉 Email verification setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { ensureEmailVerificationSetup };
