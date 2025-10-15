/**
 * Test script to verify user creation flows work correctly
 * This script tests both admin-created and self-registered users
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:5001'; // Adjust as needed

// Test data
const testUsers = {
  adminCreated: {
    username: 'admin_test_user',
    email: 'admin.test@example.com',
    password: 'testpass123',
    first_name: 'Admin',
    last_name: 'Created',
    phone_number: '+1234567890',
    role_id: 2
  },
  selfRegistered: {
    username: 'self_test_user',
    email: 'self.test@example.com',
    password: 'testpass123',
    first_name: 'Self',
    last_name: 'Registered',
    phone_number: '+1234567891',
    role_id: 2
  }
};

async function testAdminCreatedUser() {
  console.log('\n🔧 Testing Admin-Created User Flow...');
  
  try {
    // Step 1: Login as admin to get token (you'll need to adjust this)
    console.log('1. Getting admin token...');
    const adminLogin = await axios.post(`${BASE_URL}/api/users/login`, {
      email: 'admin@example.com', // Replace with your admin email
      password: 'admin123' // Replace with your admin password
    });
    
    const adminToken = adminLogin.data.data;
    console.log('✅ Admin token obtained');

    // Step 2: Create user via admin route
    console.log('2. Creating user via /api/user/create...');
    const createResponse = await axios.post(`${BASE_URL}/api/user/create`, testUsers.adminCreated, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    
    console.log('✅ User created:', createResponse.data);

    // Step 3: Try to login immediately (should work without OTP)
    console.log('3. Testing immediate login (should work)...');
    const loginResponse = await axios.post(`${BASE_URL}/api/users/login`, {
      email: testUsers.adminCreated.email,
      password: testUsers.adminCreated.password
    });
    
    console.log('✅ Admin-created user can login immediately!');
    console.log('   Token received:', !!loginResponse.data.data);
    
  } catch (error) {
    console.error('❌ Admin-created user test failed:', error.response?.data || error.message);
  }
}

async function testSelfRegisteredUser() {
  console.log('\n👤 Testing Self-Registered User Flow...');
  
  try {
    // Step 1: Register user via public route
    console.log('1. Registering user via /api/users/register...');
    const registerResponse = await axios.post(`${BASE_URL}/api/users/register`, testUsers.selfRegistered);
    
    console.log('✅ User registered:', registerResponse.data);

    // Step 2: Try to login immediately (should fail - needs OTP)
    console.log('2. Testing immediate login (should fail)...');
    try {
      const loginResponse = await axios.post(`${BASE_URL}/api/users/login`, {
        email: testUsers.selfRegistered.email,
        password: testUsers.selfRegistered.password
      });
      
      console.log('❌ Self-registered user should NOT be able to login without OTP!');
    } catch (loginError) {
      if (loginError.response?.status === 403 && loginError.response?.data?.message?.includes('verify your email')) {
        console.log('✅ Self-registered user correctly blocked - needs OTP verification');
      } else {
        console.error('❌ Unexpected login error:', loginError.response?.data || loginError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Self-registered user test failed:', error.response?.data || error.message);
  }
}

async function checkDatabaseState() {
  console.log('\n📊 Checking Database State...');
  
  try {
    // This would require a database query endpoint or direct DB access
    console.log('ℹ️  To check database state, run this SQL query:');
    console.log(`
      SELECT 
        id, email, first_name, last_name, 
        email_verified, created_by_admin, requires_email_verification,
        created_at
      FROM users 
      WHERE email IN ('${testUsers.adminCreated.email}', '${testUsers.selfRegistered.email}')
      ORDER BY created_at DESC;
    `);
    
  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  }
}

async function cleanup() {
  console.log('\n🧹 Cleanup (Optional)...');
  console.log('ℹ️  To cleanup test users, run this SQL:');
  console.log(`
    DELETE FROM users 
    WHERE email IN ('${testUsers.adminCreated.email}', '${testUsers.selfRegistered.email}');
  `);
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting User Creation Flow Tests...');
  
  await testAdminCreatedUser();
  await testSelfRegisteredUser();
  await checkDatabaseState();
  await cleanup();
  
  console.log('\n✅ All tests completed!');
  console.log('\n📋 Expected Results:');
  console.log('   - Admin-created user: Can login immediately');
  console.log('   - Self-registered user: Blocked until OTP verification');
  console.log('   - Database shows correct flags for each user type');
}

// Run if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { testAdminCreatedUser, testSelfRegisteredUser };
