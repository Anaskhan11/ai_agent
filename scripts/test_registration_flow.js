const axios = require('axios');

async function testRegistrationFlow() {
  console.log('🧪 Testing Complete Registration Flow with Real Email...\n');
  
  const baseURL = 'http://localhost:5001/api/users';
  const testUser = {
    username: 'testuser_' + Date.now(),
    email: 'info@aicruitment.com', // Use your own email for testing
    password: 'password123',
    first_name: 'Test',
    last_name: 'User',
    phone_number: '+1234567890'
  };
  
  try {
    // Step 1: Register user
    console.log('📝 Step 1: Registering user...');
    console.log('Email:', testUser.email);
    
    const registerResponse = await axios.post(`${baseURL}/register`, testUser);
    console.log('✅ Registration successful!');
    console.log('Response:', registerResponse.data);
    
    if (registerResponse.data.email_sent) {
      console.log('\n📧 Email was sent! Check your inbox for OTP.');
      console.log('💡 Since we\'re using your email server, the OTP should arrive in your inbox.');
      
      // Prompt for OTP (in a real scenario, user would get this from email)
      console.log('\n⏳ Waiting for you to check your email...');
      console.log('💡 Once you receive the OTP, you can verify it using:');
      console.log(`
curl -X POST ${baseURL}/verify-otp \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${testUser.email}",
    "otp_code": "YOUR_OTP_CODE_HERE"
  }'
      `);
      
      console.log('\n💡 After verification, you can login using:');
      console.log(`
curl -X POST ${baseURL}/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "${testUser.email}",
    "password": "${testUser.password}"
  }'
      `);
    } else {
      console.log('\n⚠️ Email was not sent, but registration completed.');
    }
    
  } catch (error) {
    console.log('\n❌ Registration flow test failed');
    
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Error:', error.response.data);
    } else {
      console.log('Error:', error.message);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure your server is running:');
      console.log('   cd backend && npm start');
    }
  }
}

// Check if server is running first
async function checkServer() {
  try {
    await axios.get('http://localhost:5001');
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const serverRunning = await checkServer();
  
  if (!serverRunning) {
    console.log('❌ Server is not running on port 5001');
    console.log('💡 Please start your server first:');
    console.log('   cd backend && npm start');
    return;
  }
  
  console.log('✅ Server is running');
  await testRegistrationFlow();
}

main();
