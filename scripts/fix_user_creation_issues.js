const pool = require('../config/DBConnection');

async function fixUserCreationIssues() {
  console.log('🔧 Fixing user creation issues...');
  
  const connection = await pool.getConnection();
  
  try {
    // Step 1: Ensure email verification columns exist
    console.log('\n📋 Step 1: Checking email verification columns...');
    
    const [columns] = await connection.execute('DESCRIBE users');
    const emailVerifiedExists = columns.some(col => col.Field === 'email_verified');
    const emailVerifiedAtExists = columns.some(col => col.Field === 'email_verified_at');
    
    if (!emailVerifiedExists) {
      console.log('🔧 Adding email_verified column...');
      await connection.execute('ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE');
      console.log('✅ email_verified column added');
    } else {
      console.log('✅ email_verified column exists');
    }
    
    if (!emailVerifiedAtExists) {
      console.log('🔧 Adding email_verified_at column...');
      await connection.execute('ALTER TABLE users ADD COLUMN email_verified_at DATETIME NULL');
      console.log('✅ email_verified_at column added');
    } else {
      console.log('✅ email_verified_at column exists');
    }
    
    // Step 2: Test basic user creation
    console.log('\n📋 Step 2: Testing basic user creation...');
    
    const testUser = {
      username: 'test_fix_' + Date.now(),
      email: 'test_fix_' + Date.now() + '@example.com',
      password_hash: '$2a$10$test.hash.here.for.testing.purposes.only',
      first_name: 'Test',
      last_name: 'Fix',
      phone_number: '+1234567890',
      role_id: 4
    };
    
    console.log('Creating test user...');
    const [createResult] = await connection.execute(
      'INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, role_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [testUser.username, testUser.email, testUser.password_hash, testUser.first_name, testUser.last_name, testUser.phone_number, testUser.role_id]
    );
    
    const testUserId = createResult.insertId;
    console.log('✅ Test user created with ID:', testUserId);
    
    // Step 3: Test email verification update
    console.log('\n📋 Step 3: Testing email verification update...');
    
    const [updateResult] = await connection.execute(
      'UPDATE users SET email_verified = ?, email_verified_at = NOW() WHERE id = ?',
      [true, testUserId]
    );
    
    console.log('✅ Email verification update successful. Affected rows:', updateResult.affectedRows);
    
    // Step 4: Verify the update worked
    console.log('\n📋 Step 4: Verifying the update...');
    
    const [verifyResult] = await connection.execute(
      'SELECT id, email, email_verified, email_verified_at FROM users WHERE id = ?',
      [testUserId]
    );
    
    console.log('✅ Verification result:', verifyResult[0]);
    
    // Step 5: Clean up test user
    console.log('\n📋 Step 5: Cleaning up test user...');
    
    await connection.execute('DELETE FROM users WHERE id = ?', [testUserId]);
    console.log('✅ Test user cleaned up');
    
    // Step 6: Check for any existing users that might need fixing
    console.log('\n📋 Step 6: Checking existing users...');
    
    const [existingUsers] = await connection.execute(
      'SELECT COUNT(*) as count FROM users WHERE email_verified IS NULL'
    );
    
    if (existingUsers[0].count > 0) {
      console.log(`⚠️  Found ${existingUsers[0].count} users with NULL email_verified status`);
      console.log('🔧 Fixing NULL email_verified values...');
      
      await connection.execute(
        'UPDATE users SET email_verified = FALSE WHERE email_verified IS NULL'
      );
      
      console.log('✅ Fixed NULL email_verified values');
    } else {
      console.log('✅ No users with NULL email_verified status');
    }
    
    // Step 7: Show summary
    console.log('\n📊 Summary:');
    const [userStats] = await connection.execute(`
      SELECT 
        COUNT(*) as total_users,
        SUM(CASE WHEN email_verified = TRUE THEN 1 ELSE 0 END) as verified_users,
        SUM(CASE WHEN email_verified = FALSE THEN 1 ELSE 0 END) as unverified_users
      FROM users
    `);
    
    console.log('User statistics:', userStats[0]);
    
  } catch (error) {
    console.error('❌ Error during fix:', error);
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

// Test the User model functions
async function testUserModelFunctions() {
  console.log('\n🧪 Testing User model functions...');
  
  try {
    const User = require('../model/userModel/userModel');
    
    // Test createUser function
    console.log('Testing createUser function...');
    const testUser = {
      username: 'model_test_' + Date.now(),
      email: 'model_test_' + Date.now() + '@example.com',
      password_hash: '$2a$10$test.hash.here',
      first_name: 'Model',
      last_name: 'Test',
      phone_number: '+1234567890',
      role_id: 4
    };
    
    const userId = await User.createUser(testUser);
    console.log('✅ createUser successful. User ID:', userId);
    
    // Test updateEmailVerificationById function
    console.log('Testing updateEmailVerificationById function...');
    const updateResult = await User.updateEmailVerificationById(userId, true);
    console.log('✅ updateEmailVerificationById successful. Affected rows:', updateResult);
    
    // Test findUserById function
    console.log('Testing findUserById function...');
    const foundUser = await User.findUserById(userId);
    console.log('✅ findUserById successful. Email verified:', foundUser.email_verified);
    
    // Clean up
    console.log('Cleaning up test user...');
    await User.deleteUser(userId);
    console.log('✅ Test user cleaned up');
    
  } catch (error) {
    console.error('❌ User model test failed:', error);
    throw error;
  }
}

// Run all fixes
async function runAllFixes() {
  await fixUserCreationIssues();
  await testUserModelFunctions();
  console.log('\n🎉 All fixes completed successfully!');
}

// Run if called directly
if (require.main === module) {
  runAllFixes()
    .then(() => {
      console.log('\n✅ User creation issues fixed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixUserCreationIssues, testUserModelFunctions };
