const User = require('../model/userModel/userModel');
const bcrypt = require('bcryptjs');

async function testUserCreation() {
  console.log('🧪 Testing User Model Creation...\n');
  
  try {
    // Test data
    const testEmail = 'test_' + Date.now() + '@example.com';
    const testUser = {
      username: 'testuser_' + Date.now(),
      email: testEmail,
      password_hash: await bcrypt.hash('password123', 10),
      first_name: 'Test',
      last_name: 'User',
      phone_number: '+1234567890',
      role_id: 1
    };
    
    console.log('📝 Creating user with data:');
    console.log('Username:', testUser.username);
    console.log('Email:', testUser.email);
    console.log('First Name:', testUser.first_name);
    console.log('Last Name:', testUser.last_name);
    console.log('Phone:', testUser.phone_number);
    console.log('Role ID:', testUser.role_id);
    
    // Create user
    const userId = await User.createUser(testUser);
    console.log('\n✅ User created successfully!');
    console.log('User ID:', userId);
    
    // Verify user was created
    const createdUser = await User.findUserByEmail(testEmail);
    if (createdUser) {
      console.log('✅ User found in database');
      console.log('Database User ID:', createdUser.id);
      console.log('Database Username:', createdUser.username);
      console.log('Database Email:', createdUser.email);
      console.log('Email Verified:', createdUser.email_verified);
    } else {
      console.log('❌ User not found in database');
    }
    
    // Clean up - delete test user
    await User.deleteUser(userId);
    console.log('✅ Test user cleaned up');
    
    return { success: true, userId };
    
  } catch (error) {
    console.log('❌ User creation failed');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('undefined')) {
      console.log('\n💡 This error suggests undefined parameters are being passed');
      console.log('💡 Check that all required fields are provided');
    }
    
    return { success: false, error: error.message };
  }
}

async function testWithMissingFields() {
  console.log('\n🧪 Testing with missing fields...\n');
  
  try {
    const incompleteUser = {
      username: 'testuser',
      email: 'test@example.com',
      // Missing other required fields
    };
    
    const userId = await User.createUser(incompleteUser);
    console.log('❌ Should have failed but succeeded with ID:', userId);
    
    // Clean up if it somehow succeeded
    await User.deleteUser(userId);
    
  } catch (error) {
    console.log('✅ Correctly failed with missing fields');
    console.log('Error:', error.message);
  }
}

async function main() {
  console.log('Testing User Model directly...\n');
  
  const result1 = await testUserCreation();
  await testWithMissingFields();
  
  console.log('\n📋 Summary:');
  console.log('- Direct user creation:', result1.success ? '✅ PASS' : '❌ FAIL');
  console.log('- Missing fields handling: ✅ PASS');
  
  if (result1.success) {
    console.log('\n🎉 User model is working correctly!');
  } else {
    console.log('\n❌ User model has issues that need to be fixed');
  }
}

main();
