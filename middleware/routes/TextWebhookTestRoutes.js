const express = require('express');
const router = express.Router();
const TextWebhookService = require('../services/TextWebhookService');

// Test text webhook by sending a test SMS
router.post('/test', async (req, res) => {
  try {
    const { toPhoneNumber, message, fromPhoneNumber } = req.body;

    // Validate required fields
    if (!toPhoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'toPhoneNumber and message are required'
      });
    }

    console.log('🧪 Testing text webhook with:', { toPhoneNumber, message, fromPhoneNumber });

    // Send test SMS
    const result = await TextWebhookService.sendSMS(
      toPhoneNumber, 
      message, 
      fromPhoneNumber
    );

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Test SMS sent successfully',
        data: {
          messageId: result.messageId,
          status: result.status
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Failed to send test SMS',
        error: result.error
      });
    }
  } catch (error) {
    console.error('Error testing text webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Test Twilio connection
router.get('/test-connection', async (req, res) => {
  try {
    console.log('🧪 Testing Twilio connection...');
    
    const result = await TextWebhookService.testTwilioConnection();
    
    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Twilio connection successful',
        data: {
          accountName: result.accountName,
          accountSid: result.accountSid
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Twilio connection failed',
        error: result.error,
        code: result.code
      });
    }
  } catch (error) {
    console.error('Error testing Twilio connection:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

module.exports = router;
