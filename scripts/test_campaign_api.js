const axios = require('axios');

async function testCampaignAPI() {
  try {
    console.log('🧪 Testing Campaign API...\n');
    
    const baseURL = 'http://localhost:5001';
    
    // First, login as demo user
    console.log('1️⃣ Attempting demo login...');
    const loginResponse = await axios.post(`${baseURL}/api/auth/demo-login`, {});
    console.log('✅ Demo login successful');
    
    const token = loginResponse.data.data.token;
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Test campaigns endpoint
    console.log('\n2️⃣ Testing campaigns endpoint...');
    try {
      const campaignResponse = await axios.get(`${baseURL}/api/outboundcall/campaigns`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 15000
      });
      
      console.log('✅ Campaigns API response:');
      console.log('   Status:', campaignResponse.status);
      console.log('   Success:', campaignResponse.data.success);
      console.log('   Message:', campaignResponse.data.message);
      console.log('   Data type:', typeof campaignResponse.data.data);
      console.log('   Data length:', Array.isArray(campaignResponse.data.data) ? campaignResponse.data.data.length : 'Not an array');
      
      if (campaignResponse.data.data && Array.isArray(campaignResponse.data.data)) {
        console.log('   Campaigns:', campaignResponse.data.data.length, 'found');
        if (campaignResponse.data.data.length > 0) {
          console.log('   First campaign ID:', campaignResponse.data.data[0].id);
        }
      }
      
    } catch (campaignError) {
      console.log('❌ Campaigns API failed:');
      console.log('   Status:', campaignError.response?.status);
      console.log('   Status Text:', campaignError.response?.statusText);
      console.log('   Error Message:', campaignError.message);
      console.log('   Response Data:', campaignError.response?.data);
      
      if (campaignError.message.includes('JSON')) {
        console.log('🔍 This appears to be a JSON parsing error');
      }
      
      if (campaignError.code === 'ECONNABORTED') {
        console.log('⏰ Request timed out');
      }
    }
    
    // Test VAPI connection directly
    console.log('\n3️⃣ Testing VAPI connection test endpoint...');
    try {
      const vapiTestResponse = await axios.get(`${baseURL}/api/outboundcall/test-vapi`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 15000
      });
      
      console.log('✅ VAPI test response:');
      console.log('   Status:', vapiTestResponse.status);
      console.log('   Data:', JSON.stringify(vapiTestResponse.data, null, 2));
      
    } catch (vapiTestError) {
      console.log('❌ VAPI test failed:');
      console.log('   Status:', vapiTestError.response?.status);
      console.log('   Error:', vapiTestError.response?.data || vapiTestError.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing campaign API:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure the backend server is running on port 5001');
    }
  }
}

// Run the test
testCampaignAPI();
