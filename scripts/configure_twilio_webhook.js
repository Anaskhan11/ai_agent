const twilio = require('twilio');
require('dotenv').config({ path: '../config/config.env' });

// Twilio configuration
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'AC9a586635a05429bf70270a3d01832733';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '890c9bbfefa0e771c6d3a8247ca2b0c5';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+13462331126';
const BASE_URL = process.env.BASE_URL || 'https://ai.research-hero.com';

// Initialize Twilio client
const twilioClient = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

/**
 * Configure Twilio webhook URLs for the phone number
 */
async function configureTwilioWebhook() {
  try {
    console.log('🔧 Configuring Twilio webhook...');
    console.log(`📱 Phone Number: ${TWILIO_PHONE_NUMBER}`);
    console.log(`🌐 Base URL: ${BASE_URL}`);

    // Webhook URLs
    const smsWebhookUrl = `${BASE_URL}/api/twilio-webhook/sms`;
    const statusWebhookUrl = `${BASE_URL}/api/twilio-webhook/status`;

    console.log(`📥 SMS Webhook URL: ${smsWebhookUrl}`);
    console.log(`📊 Status Webhook URL: ${statusWebhookUrl}`);

    // Get the phone number resource
    const phoneNumbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber: TWILIO_PHONE_NUMBER
    });

    if (phoneNumbers.length === 0) {
      console.log(`❌ Phone number ${TWILIO_PHONE_NUMBER} not found in Twilio account`);
      return;
    }

    const phoneNumberSid = phoneNumbers[0].sid;
    console.log(`📞 Phone Number SID: ${phoneNumberSid}`);

    // Update the phone number with webhook URLs
    const updatedPhoneNumber = await twilioClient.incomingPhoneNumbers(phoneNumberSid)
      .update({
        smsUrl: smsWebhookUrl,
        smsMethod: 'POST',
        statusCallback: statusWebhookUrl,
        statusCallbackMethod: 'POST'
      });

    console.log('✅ Twilio webhook configured successfully!');
    console.log(`📱 Phone Number: ${updatedPhoneNumber.phoneNumber}`);
    console.log(`📥 SMS URL: ${updatedPhoneNumber.smsUrl}`);
    console.log(`📊 Status Callback: ${updatedPhoneNumber.statusCallback}`);

  } catch (error) {
    console.error('❌ Error configuring Twilio webhook:', error);
    
    if (error.code === 20404) {
      console.log('💡 Make sure the phone number exists in your Twilio account');
    } else if (error.code === 20003) {
      console.log('💡 Check your Twilio credentials (Account SID and Auth Token)');
    }
  }
}

/**
 * Test the webhook configuration
 */
async function testWebhookConfiguration() {
  try {
    console.log('\n🧪 Testing webhook configuration...');

    // Get the phone number configuration
    const phoneNumbers = await twilioClient.incomingPhoneNumbers.list({
      phoneNumber: TWILIO_PHONE_NUMBER
    });

    if (phoneNumbers.length === 0) {
      console.log(`❌ Phone number ${TWILIO_PHONE_NUMBER} not found`);
      return;
    }

    const phoneNumber = phoneNumbers[0];
    console.log('📋 Current Configuration:');
    console.log(`  📱 Phone Number: ${phoneNumber.phoneNumber}`);
    console.log(`  📥 SMS URL: ${phoneNumber.smsUrl || 'Not configured'}`);
    console.log(`  📊 Status Callback: ${phoneNumber.statusCallback || 'Not configured'}`);
    console.log(`  🔧 SMS Method: ${phoneNumber.smsMethod || 'GET'}`);

    // Check if webhooks are properly configured
    const expectedSmsUrl = `${BASE_URL}/api/twilio-webhook/sms`;
    const expectedStatusUrl = `${BASE_URL}/api/twilio-webhook/status`;

    if (phoneNumber.smsUrl === expectedSmsUrl) {
      console.log('✅ SMS webhook URL is correctly configured');
    } else {
      console.log('❌ SMS webhook URL needs to be configured');
    }

    if (phoneNumber.statusCallback === expectedStatusUrl) {
      console.log('✅ Status webhook URL is correctly configured');
    } else {
      console.log('❌ Status webhook URL needs to be configured');
    }

  } catch (error) {
    console.error('❌ Error testing webhook configuration:', error);
  }
}

// Main execution
async function main() {
  console.log('🚀 Twilio Webhook Configuration Tool');
  console.log('=====================================\n');

  // First test current configuration
  await testWebhookConfiguration();

  // Ask user if they want to configure
  console.log('\n❓ Do you want to configure the webhook URLs? (This will update your Twilio phone number settings)');
  console.log('💡 Make sure your server is accessible at:', BASE_URL);
  
  // For now, automatically configure (in production, you might want user confirmation)
  await configureTwilioWebhook();
  
  // Test again after configuration
  await testWebhookConfiguration();
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  configureTwilioWebhook,
  testWebhookConfiguration
};
