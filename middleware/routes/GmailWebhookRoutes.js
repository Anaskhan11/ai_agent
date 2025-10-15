const express = require("express");
const gmailWebhookController = require("../controller/GmailWebhookController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Handle Gmail push notifications (no auth - public endpoint for Google Pub/Sub)
router.post("/notifications", gmailWebhookController.handleGmailPushNotification);

// Set up Gmail watch for user (requires auth)
router.post("/watch", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }
    
    const result = await gmailWebhookController.setupGmailWatch(userId);
    
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error("Error setting up Gmail watch:", error);
    res.status(500).json({
      success: false,
      message: "Failed to set up Gmail watch",
      error: error.message
    });
  }
});

// Stop Gmail watch for user (requires auth)
router.post("/stop-watch", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }
    
    await gmailWebhookController.stopGmailWatch(userId);
    
    res.status(200).json({
      success: true,
      message: "Gmail watch stopped successfully"
    });
  } catch (error) {
    console.error("Error stopping Gmail watch:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stop Gmail watch",
      error: error.message
    });
  }
});

// Process new emails for user (requires auth)
router.post("/process-emails", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    await gmailWebhookController.processNewEmails(userId);

    res.status(200).json({
      success: true,
      message: "Emails processed successfully"
    });
  } catch (error) {
    console.error("Error processing emails:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process emails",
      error: error.message
    });
  }
});

// Get Gmail watch status for user (requires auth)
router.get("/watch-status", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const status = await gmailWebhookController.getGmailWatchStatus(userId);

    res.status(200).json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error("Error getting Gmail watch status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get Gmail watch status",
      error: error.message
    });
  }
});

// Get Gmail webhook statistics (requires auth)
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const pool = require('../config/DBConnection');
    const connection = await pool.getConnection();

    try {
      // Get email statistics
      const [emailStats] = await connection.execute(
        `SELECT
           COUNT(*) as total_emails,
           COUNT(CASE WHEN processed = 1 THEN 1 END) as processed_emails,
           COUNT(CASE WHEN attachments_count > 0 THEN 1 END) as emails_with_attachments,
           MAX(created_at) as last_email_received
         FROM gmail_emails
         WHERE user_id = ?`,
        [userId]
      );

      // Get webhook trigger statistics
      const [triggerStats] = await connection.execute(
        `SELECT
           COUNT(*) as total_triggers,
           COUNT(DISTINCT webhook_id) as active_webhooks,
           MAX(created_at) as last_trigger
         FROM gmail_webhook_triggers
         WHERE user_id = ?`,
        [userId]
      );

      // Get recent webhook failures
      const [failureStats] = await connection.execute(
        `SELECT COUNT(*) as total_failures
         FROM webhook_failures wf
         JOIN webhooks w ON wf.webhook_id = w.id
         WHERE w.user_id = ? AND w.trigger_type = 'gmail'
         AND wf.created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
        [userId]
      );

      res.status(200).json({
        success: true,
        data: {
          emails: emailStats[0],
          triggers: triggerStats[0],
          failures: failureStats[0]
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error getting Gmail webhook stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get Gmail webhook statistics",
      error: error.message
    });
  }
});

module.exports = router;