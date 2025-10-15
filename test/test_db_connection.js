const pool = require('../config/DBConnection');

async function testDatabaseConnection() {
  console.log('🔍 Testing database connection...');
  
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful');
    
    // Test basic query
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Basic query successful:', rows);
    
    // Test users table structure
    const [columns] = await connection.execute(`
      DESCRIBE users
    `);
    console.log('✅ Users table structure:');
    columns.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `default: ${col.Default}` : ''}`);
    });
    
    // Test if email_verified column exists
    const emailVerifiedColumn = columns.find(col => col.Field === 'email_verified');
    if (emailVerifiedColumn) {
      console.log('✅ email_verified column exists:', emailVerifiedColumn);
    } else {
      console.log('❌ email_verified column does NOT exist');
    }
    
    // Test if email_verified_at column exists
    const emailVerifiedAtColumn = columns.find(col => col.Field === 'email_verified_at');
    if (emailVerifiedAtColumn) {
      console.log('✅ email_verified_at column exists:', emailVerifiedAtColumn);
    } else {
      console.log('❌ email_verified_at column does NOT exist');
    }
    
    connection.release();
    
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
  }
}

async function testUserCreation() {
  console.log('\n🧪 Testing user creation...');
  
  try {
    const User = require('../model/userModel/userModel');
    
    const testUser = {
      username: 'test_user_' + Date.now(),
      email: 'test_' + Date.now() + '@example.com',
      password_hash: '$2a$10$test.hash.here',
      first_name: 'Test',
      last_name: 'User',
      phone_number: '+1234567890',
      role_id: 4
    };
    
    console.log('Creating test user:', testUser);
    
    const userId = await User.createUser(testUser);
    console.log('✅ User created successfully with ID:', userId);
    
    // Test email verification update
    console.log('Testing email verification update...');
    const updateResult = await User.updateEmailVerificationById(userId, true);
    console.log('✅ Email verification updated:', updateResult);
    
    // Clean up - delete test user
    console.log('Cleaning up test user...');
    await User.deleteUser(userId);
    console.log('✅ Test user deleted');
    
  } catch (error) {
    console.error('❌ User creation test failed:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
  }
}

async function runAllTests() {
  await testDatabaseConnection();
  await testUserCreation();
  console.log('\n🎉 All tests completed!');
}

if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testDatabaseConnection, testUserCreation };
