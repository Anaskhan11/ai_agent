const axios = require('axios');

async function testCreditAPI() {
  try {
    console.log('🧪 Testing Credit API Endpoint...\n');
    
    // Test the credit balance endpoint
    const baseURL = 'http://localhost:5001'; // Backend runs on port 5001
    
    // First, try to login as demo user
    console.log('1️⃣ Attempting demo login...');
    try {
      const loginResponse = await axios.post(`${baseURL}/api/auth/demo-login`, {});
      console.log('✅ Demo login successful');
      
      const token = loginResponse.data.data.token;
      console.log(`   Token: ${token.substring(0, 20)}...`);
      
      // Test credit balance endpoint
      console.log('\n2️⃣ Testing credit balance endpoint...');
      const creditResponse = await axios.get(`${baseURL}/api/credits/balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Credit balance API response:');
      console.log('   Status:', creditResponse.status);
      console.log('   Data:', JSON.stringify(creditResponse.data, null, 2));
      
      const creditData = creditResponse.data.data;
      if (creditData) {
        console.log('\n📊 Parsed Credit Data:');
        console.log(`   Available Credits: ${creditData.available_credits} (type: ${typeof creditData.available_credits})`);
        console.log(`   Total Credits: ${creditData.total_credits} (type: ${typeof creditData.total_credits})`);
        console.log(`   Used Credits: ${creditData.used_credits} (type: ${typeof creditData.used_credits})`);
        console.log(`   Is Super Admin: ${creditData.isSuperAdmin}`);
        
        // Test if the values are being returned as expected
        if (parseFloat(creditData.available_credits) > 0) {
          console.log('✅ User has credits available');
        } else {
          console.log('❌ User has no credits available');
        }
      }
      
    } catch (loginError) {
      console.log('❌ Demo login failed:', loginError.response?.data || loginError.message);
      
      // Try without authentication (might work for some endpoints)
      console.log('\n2️⃣ Testing credit balance endpoint without auth...');
      try {
        const creditResponse = await axios.get(`${baseURL}/api/credits/balance`);
        console.log('✅ Credit balance API response (no auth):');
        console.log('   Status:', creditResponse.status);
        console.log('   Data:', JSON.stringify(creditResponse.data, null, 2));
      } catch (noAuthError) {
        console.log('❌ Credit balance API failed (no auth):', noAuthError.response?.data || noAuthError.message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing credit API:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend server is running on the correct port');
    }
  }
}

// Run the test
testCreditAPI();
