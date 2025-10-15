const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const ContactMessagesController = require('../controller/ContactMessagesController');

// Get message history for a specific contact
router.get('/contacts/:contactId/messages', authMiddleware, ContactMessagesController.getContactMessages);

// Check for new incoming messages only (efficient polling)
router.get('/contacts/:contactId/new-messages', authMiddleware, ContactMessagesController.checkNewIncomingMessages);

// Send message to a contact
router.post('/contacts/:contactId/messages', authMiddleware, ContactMessagesController.sendMessageToContact);

// Save a message to database
router.post('/messages', authMiddleware, ContactMessagesController.saveMessage);

// Update message status
router.patch('/messages/:messageId', authMiddleware, ContactMessagesController.updateMessageStatus);

// Twilio webhook endpoint for incoming SMS (no auth - public endpoint for Twilio)
router.post('/twilio/webhook', ContactMessagesController.handleTwilioWebhook);

// Get all conversations (contacts with recent messages)
router.get('/conversations', authMiddleware, ContactMessagesController.getConversations);

// Get message statistics
router.get('/messages/stats', authMiddleware, ContactMessagesController.getMessageStats);

module.exports = router;
