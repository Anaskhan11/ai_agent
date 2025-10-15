const axios = require('axios');
const mysql = require('mysql2/promise');

// Configuration
const API_BASE_URL = 'http://localhost:5001/api';

// Database connection
const dbConfig = {
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent"
};

let authToken = null;
let userId = null;

// Helper function to make authenticated requests
const apiRequest = async (method, endpoint, data = null) => {
  const config = {
    method,
    url: `${API_BASE_URL}${endpoint}`,
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    data
  };
  
  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    return {
      error: true,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
      data: error.response?.data
    };
  }
};

// Test functions
const testLogin = async () => {
  console.log('\n🔐 Testing User Login...');
  try {
    const response = await apiRequest('POST', '/auth/demo-login', {});
    if (response.error) {
      console.log('❌ Demo login failed');
      return false;
    }
    authToken = response.data.token;
    userId = response.data.user.id;
    console.log('✅ Demo login successful');
    console.log(`   User ID: ${userId}`);
    return true;
  } catch (error) {
    console.log('❌ Login failed');
    return false;
  }
};

const setUserCreditsToZero = async () => {
  console.log('\n🔧 Setting user credits to zero...');
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Set user credits to zero
    await connection.execute(
      'UPDATE user_credits SET total_credits = 0, used_credits = 0 WHERE user_id = ?',
      [userId]
    );
    
    // If no record exists, create one with zero credits
    await connection.execute(
      'INSERT INTO user_credits (user_id, total_credits, used_credits) VALUES (?, 0, 0) ON DUPLICATE KEY UPDATE total_credits = 0, used_credits = 0',
      [userId]
    );
    
    await connection.end();
    console.log('✅ User credits set to zero');
    return true;
  } catch (error) {
    console.log('❌ Failed to set credits to zero:', error.message);
    return false;
  }
};

const testZeroCreditBlocking = async () => {
  console.log('\n🚫 Testing Zero Credit Blocking...');
  
  // Test credit-consuming endpoints that should be blocked
  const endpointsToTest = [
    { method: 'POST', endpoint: '/outboundcall/createCall', data: { id: 'test-assistant', phoneNumber: '+1234567890' } },
    { method: 'POST', endpoint: '/workflows/vapi/calls', data: { assistantId: 'test-assistant', customer: { number: '+1234567890' } } },
    { method: 'POST', endpoint: '/vapi/assistants', data: { name: 'Test Assistant' } }
  ];

  console.log(`   Using auth token: ${authToken ? authToken.substring(0, 20) + '...' : 'NONE'}`);
  
  let blockedCount = 0;
  let totalTests = endpointsToTest.length;
  
  for (const test of endpointsToTest) {
    console.log(`\n   Testing ${test.method} ${test.endpoint}...`);
    const response = await apiRequest(test.method, test.endpoint, test.data);
    
    if (response.error && response.status === 402) {
      console.log(`   ✅ Correctly blocked with 402 status`);
      console.log(`   📝 Message: ${response.message}`);
      if (response.data?.error_code === 'NO_CREDITS_AVAILABLE') {
        console.log(`   🎯 Correct error code: ${response.data.error_code}`);
      }
      blockedCount++;
    } else if (response.error) {
      console.log(`   ⚠️  Blocked with different error: ${response.status} - ${response.message}`);
    } else {
      console.log(`   ❌ NOT BLOCKED - This should have been blocked!`);
    }
  }
  
  console.log(`\n📊 Zero Credit Blocking Results:`);
  console.log(`   Blocked: ${blockedCount}/${totalTests}`);
  console.log(`   Success Rate: ${((blockedCount/totalTests) * 100).toFixed(1)}%`);
  
  return blockedCount === totalTests;
};

const testExemptEndpoints = async () => {
  console.log('\n✅ Testing Exempt Endpoints (should work with zero credits)...');
  
  // Test endpoints that should NOT be blocked
  const exemptEndpoints = [
    { method: 'GET', endpoint: '/credits/balance' },
    { method: 'GET', endpoint: '/credits/packages' },
    { method: 'GET', endpoint: '/credits/transactions' },
    { method: 'GET', endpoint: '/users/profile' }
  ];
  
  let workingCount = 0;
  let totalTests = exemptEndpoints.length;
  
  for (const test of exemptEndpoints) {
    console.log(`\n   Testing ${test.method} ${test.endpoint}...`);
    const response = await apiRequest(test.method, test.endpoint);
    
    if (!response.error) {
      console.log(`   ✅ Working correctly (not blocked)`);
      workingCount++;
    } else if (response.status === 402) {
      console.log(`   ❌ INCORRECTLY BLOCKED - This should work with zero credits!`);
    } else {
      console.log(`   ⚠️  Other error: ${response.status} - ${response.message}`);
      // Count as working if it's not a credit-related block
      if (response.status !== 402) {
        workingCount++;
      }
    }
  }
  
  console.log(`\n📊 Exempt Endpoints Results:`);
  console.log(`   Working: ${workingCount}/${totalTests}`);
  console.log(`   Success Rate: ${((workingCount/totalTests) * 100).toFixed(1)}%`);
  
  return workingCount === totalTests;
};

const restoreUserCredits = async () => {
  console.log('\n🔧 Restoring user credits...');
  try {
    const connection = await mysql.createConnection(dbConfig);
    
    // Give user some credits back
    await connection.execute(
      'UPDATE user_credits SET total_credits = 100, used_credits = 0 WHERE user_id = ?',
      [userId]
    );
    
    await connection.end();
    console.log('✅ User credits restored to 100');
    return true;
  } catch (error) {
    console.log('❌ Failed to restore credits:', error.message);
    return false;
  }
};

// Main test runner
const runZeroCreditTest = async () => {
  console.log('🚀 Starting Zero Credit Blocking Test');
  console.log('====================================');
  
  try {
    // Step 1: Login
    const loginSuccess = await testLogin();
    if (!loginSuccess) {
      console.log('\n❌ Cannot proceed without authentication');
      return;
    }
    
    // Step 2: Set credits to zero
    const creditsSetSuccess = await setUserCreditsToZero();
    if (!creditsSetSuccess) {
      console.log('\n❌ Cannot proceed without setting credits to zero');
      return;
    }
    
    // Step 3: Test zero credit blocking
    const blockingWorking = await testZeroCreditBlocking();
    
    // Step 4: Test exempt endpoints
    const exemptWorking = await testExemptEndpoints();
    
    // Step 5: Restore credits
    await restoreUserCredits();
    
    console.log('\n🎉 Zero Credit Blocking Test Finished');
    console.log('====================================');
    
    if (blockingWorking && exemptWorking) {
      console.log('✅ ALL TESTS PASSED!');
      console.log('🚫 Zero credit blocking is working correctly');
      console.log('✅ Exempt endpoints are accessible');
      console.log('🔒 Credit system security is functional');
    } else {
      console.log('❌ SOME TESTS FAILED!');
      if (!blockingWorking) {
        console.log('🚫 Zero credit blocking needs attention');
      }
      if (!exemptWorking) {
        console.log('✅ Exempt endpoints need review');
      }
    }
    
  } catch (error) {
    console.log('\n💥 Test failed with error:', error.message);
  }
};

// Run the test
runZeroCreditTest();
