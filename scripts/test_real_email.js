const EmailService = require('../services/EmailService');

async function testRealEmail() {
  console.log('🧪 Testing Real Email Configuration...\n');
  
  try {
    // Test connection first
    console.log('📡 Testing SMTP connection...');
    const connectionTest = await EmailService.testConnection();
    
    if (!connectionTest) {
      console.log('❌ SMTP connection failed');
      return;
    }
    
    console.log('✅ SMTP connection successful\n');
    
    // Test sending actual email
    console.log('📧 Sending test OTP email...');
    const result = await EmailService.sendOTPEmail('test@example.com', '123456', 'Test User');
    
    if (result.success) {
      console.log('\n✅ Email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      
      if (result.testMode) {
        console.log('\n💡 Running in test mode - check console output above');
      } else {
        console.log('\n📨 Real email was sent using your SMTP configuration!');
        console.log('📧 SMTP Host:', process.env.SMTP_HOST);
        console.log('📧 SMTP Port:', process.env.SMTP_PORT);
        console.log('📧 SMTP User:', process.env.SMTP_USER);
      }
    } else {
      console.log('\n❌ Email sending failed');
      console.log('Error:', result.error);
      
      // Common troubleshooting tips
      console.log('\n🔧 Troubleshooting tips:');
      console.log('1. Check if SMTP credentials are correct');
      console.log('2. Verify SMTP host and port settings');
      console.log('3. Check if your email provider allows SMTP');
      console.log('4. Ensure firewall/network allows outbound connections');
    }
  } catch (error) {
    console.log('\n❌ Test failed with exception');
    console.error('Error:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n🔧 Connection refused - check SMTP host and port');
    } else if (error.code === 'EAUTH') {
      console.log('\n🔧 Authentication failed - check username and password');
    } else if (error.code === 'ETIMEDOUT') {
      console.log('\n🔧 Connection timeout - check network/firewall settings');
    }
  }
  
  console.log('\n📋 Current Configuration:');
  console.log('SMTP_HOST:', process.env.SMTP_HOST);
  console.log('SMTP_PORT:', process.env.SMTP_PORT);
  console.log('SMTP_USER:', process.env.SMTP_USER);
  console.log('SMTP_PASS:', process.env.SMTP_PASS ? '***configured***' : 'NOT SET');
  console.log('APP_NAME:', process.env.APP_NAME);
}

testRealEmail();
