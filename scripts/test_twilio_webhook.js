const axios = require('axios');
require('dotenv').config({ path: '../config/config.env' });

const BASE_URL = process.env.BASE_URL || 'https://ai.research-hero.com';

/**
 * Test the Twilio webhook endpoint with sample data
 */
async function testTwilioWebhook() {
  try {
    console.log('🧪 Testing Twilio webhook endpoint...');
    console.log(`🌐 Base URL: ${BASE_URL}`);

    // Sample Twilio webhook data (what Twilio would send)
    const sampleWebhookData = {
      MessageSid: 'SM' + Math.random().toString(36).substr(2, 32),
      Body: 'Hello! This is a test message from a contact.',
      From: '+1234567890', // This should match a contact's phone number in your database
      To: '+13462331126',   // Your Twilio phone number
      MessageStatus: 'received',
      AccountSid: 'AC9a586635a05429bf70270a3d01832733'
    };

    console.log('📤 Sending test webhook data:');
    console.log(JSON.stringify(sampleWebhookData, null, 2));

    // Send POST request to webhook endpoint
    const webhookUrl = `${BASE_URL}/api/twilio-webhook/sms`;
    console.log(`📥 Webhook URL: ${webhookUrl}`);

    const response = await axios.post(webhookUrl, sampleWebhookData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    console.log('✅ Webhook test successful!');
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📝 Response Data: ${response.data}`);

  } catch (error) {
    console.error('❌ Webhook test failed:', error.message);
    
    if (error.response) {
      console.log(`📊 Response Status: ${error.response.status}`);
      console.log(`📝 Response Data: ${error.response.data}`);
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Make sure your server is running and accessible');
    } else if (error.code === 'ENOTFOUND') {
      console.log('💡 Check your BASE_URL configuration');
    }
  }
}

/**
 * Test the status webhook endpoint
 */
async function testStatusWebhook() {
  try {
    console.log('\n🧪 Testing Twilio status webhook endpoint...');

    // Sample status webhook data
    const sampleStatusData = {
      MessageSid: 'SM' + Math.random().toString(36).substr(2, 32),
      MessageStatus: 'delivered',
      AccountSid: 'AC9a586635a05429bf70270a3d01832733'
    };

    console.log('📤 Sending test status data:');
    console.log(JSON.stringify(sampleStatusData, null, 2));

    const statusUrl = `${BASE_URL}/api/twilio-webhook/status`;
    console.log(`📥 Status URL: ${statusUrl}`);

    const response = await axios.post(statusUrl, sampleStatusData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      timeout: 10000
    });

    console.log('✅ Status webhook test successful!');
    console.log(`📊 Response Status: ${response.status}`);
    console.log(`📝 Response Data: ${response.data}`);

  } catch (error) {
    console.error('❌ Status webhook test failed:', error.message);
    
    if (error.response) {
      console.log(`📊 Response Status: ${error.response.status}`);
      console.log(`📝 Response Data: ${error.response.data}`);
    }
  }
}

/**
 * Check if webhook endpoints are accessible
 */
async function checkWebhookEndpoints() {
  try {
    console.log('🔍 Checking webhook endpoint accessibility...');

    const endpoints = [
      `${BASE_URL}/api/twilio-webhook/sms`,
      `${BASE_URL}/api/twilio-webhook/status`
    ];

    for (const endpoint of endpoints) {
      try {
        // Try a GET request first to see if endpoint exists
        const response = await axios.get(endpoint, { timeout: 5000 });
        console.log(`✅ ${endpoint} - Accessible (Status: ${response.status})`);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          console.log(`❌ ${endpoint} - Not found (404)`);
        } else if (error.response && error.response.status === 405) {
          console.log(`✅ ${endpoint} - Accessible (Method not allowed - expected for POST endpoint)`);
        } else {
          console.log(`❌ ${endpoint} - Error: ${error.message}`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Error checking endpoints:', error.message);
  }
}

// Main execution
async function main() {
  console.log('🚀 Twilio Webhook Test Tool');
  console.log('============================\n');

  // Check endpoint accessibility
  await checkWebhookEndpoints();

  // Test SMS webhook
  await testTwilioWebhook();

  // Test status webhook
  await testStatusWebhook();

  console.log('\n📋 Next Steps:');
  console.log('1. Make sure your server is running and accessible');
  console.log('2. Configure Twilio webhook URLs using: node configure_twilio_webhook.js');
  console.log('3. Test by sending an SMS to your Twilio number from a contact\'s phone');
  console.log('4. Check the contact_messages table for incoming messages');
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  testTwilioWebhook,
  testStatusWebhook,
  checkWebhookEndpoints
};
