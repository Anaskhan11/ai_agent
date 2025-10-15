const express = require('express');
const router = express.Router();
const GmailNotificationController = require('../controller/GmailNotificationController');
const authMiddleware = require('../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all users with connected Gmail accounts
router.get('/connected-users', GmailNotificationController.getConnectedGmailUsers);

// Test Gmail connection for a specific user
router.get('/test-connection/:userId', GmailNotificationController.testGmailConnection);

// Send test notification to connected Gmail accounts
router.post('/test-notification/:webhookId', GmailNotificationController.sendTestNotification);

// Get notification history for a webhook
router.get('/notification-history/:webhookId', GmailNotificationController.getNotificationHistory);

// Get notification statistics
router.get('/stats', GmailNotificationController.getNotificationStats);

// Disconnect Gmail for a user
router.delete('/disconnect/:userId', GmailNotificationController.disconnectGmail);

// Get Gmail connection status for current user
router.get('/my-status', GmailNotificationController.getMyGmailStatus);

// Generate Gmail OAuth URL for current user
router.get('/auth-url', GmailNotificationController.generateGmailAuthUrl);

module.exports = router;
