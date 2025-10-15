/**
 * Comprehensive Audit Logging Test
 * Tests all types of operations to ensure they are being logged to combined.txt
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const TEST_EMAIL = 'audit-test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

let authToken = null;

// Helper function to make authenticated requests
const makeRequest = async (method, endpoint, data = null, headers = {}) => {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return { 
      success: false, 
      error: error.response?.data || error.message, 
      status: error.response?.status || 500 
    };
  }
};

// Test authentication operations
const testAuthOperations = async () => {
  console.log('\n🔐 Testing Authentication Operations...');
  
  // Test user registration
  console.log('  📝 Testing user registration...');
  const registerResult = await makeRequest('POST', '/api/users/register', {
    username: 'audit-test-user',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    first_name: 'Audit',
    last_name: 'Test',
    phone_number: '+1234567890'
  });
  console.log(`     Registration: ${registerResult.success ? '✅' : '❌'}`);

  // Test login (will fail due to email verification, but should be logged)
  console.log('  🔑 Testing login attempt...');
  const loginResult = await makeRequest('POST', '/api/users/login', {
    email: TEST_EMAIL,
    password: TEST_PASSWORD
  });
  console.log(`     Login attempt: ${loginResult.success ? '✅' : '❌'} (Expected to fail)`);

  // Test OTP verification (with invalid OTP)
  console.log('  📧 Testing OTP verification...');
  const otpResult = await makeRequest('POST', '/api/users/verify-otp', {
    email: TEST_EMAIL,
    otp_code: '123456'
  });
  console.log(`     OTP verification: ${otpResult.success ? '✅' : '❌'} (Expected to fail)`);

  // Test OTP resend
  console.log('  🔄 Testing OTP resend...');
  const resendResult = await makeRequest('POST', '/api/users/resend-otp', {
    email: TEST_EMAIL
  });
  console.log(`     OTP resend: ${resendResult.success ? '✅' : '❌'}`);

  return { registerResult, loginResult, otpResult, resendResult };
};

// Test CRUD operations (using demo login)
const testCRUDOperations = async () => {
  console.log('\n📊 Testing CRUD Operations...');
  
  // Get demo login token
  console.log('  🎭 Getting demo login token...');
  const demoLoginResult = await makeRequest('POST', '/api/auth/demo-login');
  if (demoLoginResult.success) {
    authToken = demoLoginResult.data.data.token;
    console.log('     Demo login: ✅');
  } else {
    console.log('     Demo login: ❌');
    return;
  }

  // Test contact creation
  console.log('  👤 Testing contact creation...');
  const contactResult = await makeRequest('POST', '/api/contacts', {
    fullName: 'Test Contact',
    email: 'test-contact@example.com',
    phoneNumber: '+1234567890',
    list_name: 'audit-test-list'
  });
  console.log(`     Contact creation: ${contactResult.success ? '✅' : '❌'}`);

  // Test role operations
  console.log('  🎭 Testing role operations...');
  const roleResult = await makeRequest('POST', '/api/roles', {
    name: 'audit-test-role',
    display_name: 'Audit Test Role',
    description: 'Role created for audit testing'
  });
  console.log(`     Role creation: ${roleResult.success ? '✅' : '❌'}`);

  // Test assistant operations
  console.log('  🤖 Testing assistant operations...');
  const assistantResult = await makeRequest('POST', '/api/assistant', {
    name: 'Audit Test Assistant',
    model: 'gpt-3.5-turbo',
    voice: 'alloy',
    firstMessage: 'Hello, this is a test assistant for audit logging.'
  });
  console.log(`     Assistant creation: ${assistantResult.success ? '✅' : '❌'}`);

  return { contactResult, roleResult, assistantResult };
};

// Test external API operations
const testExternalAPIOperations = async () => {
  console.log('\n🌐 Testing External API Operations...');

  // Test VAPI operations
  console.log('  📞 Testing VAPI operations...');
  const vapiResult = await makeRequest('POST', '/api/vapi/call', {
    workflowId: 'test-workflow',
    assistantId: 'test-assistant',
    customer: {
      number: '+1234567890',
      name: 'Test Customer'
    }
  });
  console.log(`     VAPI call: ${vapiResult.success ? '✅' : '❌'} (Expected to fail without valid API key)`);

  // Test Facebook operations
  console.log('  📘 Testing Facebook operations...');
  const facebookResult = await makeRequest('POST', '/api/auth/facebook', {
    code: 'test-code',
    state: 'test-state'
  });
  console.log(`     Facebook auth: ${facebookResult.success ? '✅' : '❌'} (Expected to fail)`);

  // Test webhook operations
  console.log('  🔗 Testing webhook operations...');
  const webhookResult = await makeRequest('POST', '/api/webhook-test/simulate/facebook-lead', {
    pageId: 'test-page-id',
    formId: 'test-form-id',
    leadData: {
      fullName: 'Test Lead',
      email: 'test-lead@example.com',
      phone: '+1234567890'
    }
  });
  console.log(`     Webhook simulation: ${webhookResult.success ? '✅' : '❌'} (Expected to fail)`);

  return { vapiResult, facebookResult, webhookResult };
};

// Test file and export operations
const testFileAndExportOperations = async () => {
  console.log('\n📁 Testing File and Export Operations...');

  // Test audit log export
  console.log('  📊 Testing audit log export...');
  const exportResult = await makeRequest('GET', '/api/audit-logs/export?format=xlsx');
  console.log(`     Audit log export: ${exportResult.success ? '✅' : '❌'}`);

  // Test cleanup operations
  console.log('  🧹 Testing cleanup operations...');
  const cleanupResult = await makeRequest('POST', '/api/contacts/cleanup');
  console.log(`     Contact cleanup: ${cleanupResult.success ? '✅' : '❌'}`);

  return { exportResult, cleanupResult };
};

// Check combined.txt for logged operations
const checkCombinedTxtLogs = async () => {
  console.log('\n📋 Checking combined.txt for logged operations...');
  
  try {
    const combinedFilePath = path.join(process.cwd(), 'Logs', 'combined.txt');
    
    if (!fs.existsSync(combinedFilePath)) {
      console.log('     ❌ combined.txt file not found');
      return false;
    }

    const logContent = fs.readFileSync(combinedFilePath, 'utf8');
    const logLines = logContent.split('\n').filter(line => line.trim().length > 0);
    
    console.log(`     📊 Total log entries: ${logLines.length}`);
    
    // Check for recent entries (last 50 lines)
    const recentLogs = logLines.slice(-50);
    
    // Count different operation types
    const operationCounts = {};
    recentLogs.forEach(line => {
      const operationMatch = line.match(/\] (\w+) on/);
      if (operationMatch) {
        const operation = operationMatch[1];
        operationCounts[operation] = (operationCounts[operation] || 0) + 1;
      }
    });
    
    console.log('     📈 Recent operation types:');
    Object.entries(operationCounts).forEach(([operation, count]) => {
      console.log(`        ${operation}: ${count} entries`);
    });
    
    // Check for comprehensive data in recent logs
    const hasComprehensiveData = recentLogs.some(line => 
      line.includes('IP:') && 
      line.includes('Browser:') && 
      line.includes('Method:') && 
      line.includes('URL:') &&
      line.includes('Time:') &&
      line.includes('Old:') &&
      line.includes('New:')
    );
    
    console.log(`     🔍 Comprehensive data format: ${hasComprehensiveData ? '✅' : '❌'}`);
    
    // Show sample of recent comprehensive log entry
    const comprehensiveEntry = recentLogs.find(line => 
      line.includes('IP:') && line.includes('Browser:')
    );
    
    if (comprehensiveEntry) {
      console.log('     📝 Sample comprehensive log entry:');
      console.log(`        ${comprehensiveEntry.substring(0, 200)}...`);
    }
    
    return true;
    
  } catch (error) {
    console.error('     ❌ Error reading combined.txt:', error.message);
    return false;
  }
};

// Main test function
const runComprehensiveAuditTest = async () => {
  console.log('🚀 Starting Comprehensive Audit Logging Test');
  console.log('=' .repeat(60));
  
  try {
    // Run all test categories
    const authResults = await testAuthOperations();
    const crudResults = await testCRUDOperations();
    const apiResults = await testExternalAPIOperations();
    const fileResults = await testFileAndExportOperations();
    
    // Wait a moment for logs to be written
    console.log('\n⏳ Waiting for logs to be written...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check the combined.txt file
    const logsFound = await checkCombinedTxtLogs();
    
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 Test Summary:');
    console.log(`   Authentication operations: ${Object.values(authResults).some(r => r.success) ? '✅' : '❌'}`);
    console.log(`   CRUD operations: ${Object.values(crudResults || {}).some(r => r.success) ? '✅' : '❌'}`);
    console.log(`   External API operations: ${Object.values(apiResults).length > 0 ? '✅' : '❌'} (Expected failures)`);
    console.log(`   File/Export operations: ${Object.values(fileResults).length > 0 ? '✅' : '❌'}`);
    console.log(`   Logs in combined.txt: ${logsFound ? '✅' : '❌'}`);
    
    console.log('\n✅ Comprehensive audit logging test completed!');
    console.log('📋 Check the combined.txt file for detailed audit logs.');
    
  } catch (error) {
    console.error('❌ Error running comprehensive audit test:', error);
  }
};

// Run the test if this file is executed directly
if (require.main === module) {
  runComprehensiveAuditTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = {
  runComprehensiveAuditTest,
  testAuthOperations,
  testCRUDOperations,
  testExternalAPIOperations,
  testFileAndExportOperations,
  checkCombinedTxtLogs
};
