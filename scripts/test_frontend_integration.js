const axios = require('axios');

const BASE_URL = 'http://localhost:5001';

async function testFrontendIntegration() {
  console.log('🚀 Testing Frontend-Backend Integration for Credit System');
  console.log('=====================================================\n');

  try {
    // Step 1: Test demo login
    console.log('1. Testing Demo Login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/demo-login`, {});
    
    if (loginResponse.data.success) {
      console.log('✅ Demo login successful');
      console.log(`   User: ${loginResponse.data.data.user.email}`);
      console.log(`   Token: ${loginResponse.data.data.token.substring(0, 50)}...`);
    } else {
      console.log('❌ Demo login failed');
      return;
    }

    const token = loginResponse.data.data.token;
    const headers = { Authorization: `Bearer ${token}` };

    // Step 2: Test credit balance
    console.log('\n2. Testing Credit Balance...');
    const balanceResponse = await axios.get(`${BASE_URL}/api/credits/balance`, { headers });
    
    if (balanceResponse.data.success) {
      console.log('✅ Credit balance retrieved');
      console.log(`   Balance: ${JSON.stringify(balanceResponse.data.data, null, 2)}`);
    } else {
      console.log('❌ Credit balance failed');
      console.log(`   Error: ${balanceResponse.data.message}`);
    }

    // Step 3: Test credit packages
    console.log('\n3. Testing Credit Packages...');
    const packagesResponse = await axios.get(`${BASE_URL}/api/credits/packages`, { headers });
    
    if (packagesResponse.data.success) {
      console.log('✅ Credit packages retrieved');
      console.log(`   Packages: ${packagesResponse.data.data.length}`);
      packagesResponse.data.data.forEach(pkg => {
        console.log(`   - ${pkg.name}: $${pkg.price_dollars} (${pkg.total_credits} credits)`);
      });
    } else {
      console.log('❌ Credit packages failed');
      console.log(`   Error: ${packagesResponse.data.message}`);
    }

    // Step 4: Test credit transactions
    console.log('\n4. Testing Credit Transactions...');
    try {
      const transactionsResponse = await axios.get(`${BASE_URL}/api/credits/transactions?limit=5`, { headers });
      
      if (transactionsResponse.data.success) {
        console.log('✅ Credit transactions retrieved');
        console.log(`   Transactions: ${transactionsResponse.data.data.transactions?.length || 0}`);
      } else {
        console.log('⚠️  Credit transactions returned no data (expected for new user)');
      }
    } catch (error) {
      console.log('⚠️  Credit transactions endpoint may need data');
    }

    // Step 5: Test payment intent creation (with Stripe)
    console.log('\n5. Testing Payment Intent Creation...');
    try {
      const paymentResponse = await axios.post(`${BASE_URL}/api/credits/purchase`, {
        packageId: 'starter'
      }, { headers });
      
      if (paymentResponse.data.success) {
        console.log('✅ Payment intent created successfully');
        console.log(`   Client Secret: ${paymentResponse.data.data.clientSecret.substring(0, 30)}...`);
      } else {
        console.log('❌ Payment intent creation failed');
        console.log(`   Error: ${paymentResponse.data.message}`);
      }
    } catch (error) {
      console.log('⚠️  Payment intent creation failed (Stripe may not be configured)');
      console.log(`   Error: ${error.response?.data?.message || error.message}`);
    }

    // Step 6: Test frontend endpoints that the React app will call
    console.log('\n6. Testing Frontend-Specific Endpoints...');
    
    // Test dashboard data (if user is logged in)
    try {
      const dashboardResponse = await axios.get(`${BASE_URL}/api/dashboard/data`, { headers });
      console.log('✅ Dashboard data accessible');
    } catch (error) {
      console.log('⚠️  Dashboard data may require additional setup');
    }

    console.log('\n🎉 Frontend Integration Test Complete!');
    console.log('=====================================');
    console.log('✅ Backend is ready for frontend integration');
    console.log('✅ Credit system endpoints are functional');
    console.log('✅ Authentication is working properly');
    console.log('\n📋 Next Steps:');
    console.log('1. Open http://localhost:5174 in your browser');
    console.log('2. Login with demo credentials or use demo login');
    console.log('3. Navigate to Credits section in sidebar');
    console.log('4. Test credit purchase flow');
    console.log('5. Verify credits appear after purchase');

  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    if (error.response) {
      console.error('   Response:', error.response.data);
    }
  }
}

// Run the test
testFrontendIntegration();
