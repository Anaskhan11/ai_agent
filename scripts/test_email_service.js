const EmailService = require('../services/SimpleEmailService');

async function testEmailService() {
  console.log('🧪 Testing Email Service...\n');
  
  try {
    const result = await EmailService.sendOTPEmail('test@example.com', '123456', 'Test User');
    
    if (result.success) {
      console.log('\n✅ Email service test PASSED');
      console.log('📧 Result:', result);
      
      if (result.testMode) {
        console.log('\n💡 Currently running in TEST MODE (console logging)');
        console.log('💡 To send real emails, configure one of these in config.env:');
        console.log('   - SENDGRID_API_KEY for SendGrid');
        console.log('   - MAILGUN_API_KEY + MAILGUN_DOMAIN for Mailgun');
        console.log('   - RESEND_API_KEY for Resend');
      } else {
        console.log('\n📨 Real email was sent successfully!');
      }
    } else {
      console.log('\n❌ Email service test FAILED');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.log('\n❌ Email service test FAILED with exception');
    console.error('Error:', error.message);
  }
}

testEmailService();
