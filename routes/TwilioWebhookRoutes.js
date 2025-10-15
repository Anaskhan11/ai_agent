const express = require('express');
const router = express.Router();
const ContactMessagesController = require('../controller/ContactMessagesController');

// Twilio webhook endpoint for incoming SMS (no auth - public endpoint for Twilio)
router.post('/sms', ContactMessagesController.handleTwilioWebhook);

// Twilio webhook endpoint for message status updates (no auth - public endpoint for Twilio)
router.post('/status', async (req, res) => {
  try {
    console.log('📱 Received Twilio status webhook:', req.body);

    const {
      MessageSid,
      MessageStatus,
      ErrorCode,
      ErrorMessage
    } = req.body;

    if (!MessageSid || !MessageStatus) {
      console.log('❌ Missing required status webhook fields');
      return res.status(400).send('Missing required fields');
    }

    // Update message status in database
    const db = require('../config/DBConnection');
    const [result] = await db.execute(`
      UPDATE contact_messages 
      SET status = ?, updated_at = NOW()
      WHERE twilio_sid = ?
    `, [MessageStatus.toLowerCase(), MessageSid]);

    if (result.affectedRows > 0) {
      console.log(`✅ Updated message status: ${MessageSid} -> ${MessageStatus}`);
    } else {
      console.log(`⚠️ Message not found for SID: ${MessageSid}`);
    }

    // Log any errors
    if (ErrorCode) {
      console.log(`❌ Twilio error for ${MessageSid}: ${ErrorCode} - ${ErrorMessage}`);
    }

    res.status(200).send('Status updated');

  } catch (error) {
    console.error('❌ Error handling Twilio status webhook:', error);
    res.status(200).send('Error processed');
  }
});

module.exports = router;
