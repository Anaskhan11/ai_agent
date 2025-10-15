const express = require("express");
const gmailController = require("../../controller/GmailController/GmailController");
const gmailWebhookController = require("../../controller/GmailWebhookController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Gmail OAuth Routes
router.get("/auth/url", authMiddleware, gmailController.generateGmailAuthUrl);
router.get("/auth/proxy", gmailController.serveGmailOAuthProxy); // Proxy route for iframe
router.get("/auth/callback", gmailController.handleGmailOAuthCallback); // GET route for OAuth redirect
router.post("/auth/callback", gmailController.handleGmailCallback); // Keep existing POST route
router.get("/auth/status", authMiddleware, gmailController.getGmailStatus);
router.delete("/auth/disconnect", authMiddleware, gmailController.disconnectGmail);

// Gmail Email Routes
router.get("/emails", authMiddleware, gmailController.listEmails);
router.get("/emails/:messageId", authMiddleware, gmailController.getEmailDetails);
router.get("/emails/stored", authMiddleware, gmailController.getStoredEmails);
router.post("/emails/send", authMiddleware, gmailController.sendEmail);
router.post("/emails/send-bulk", authMiddleware, gmailController.sendBulkEmails);

// Gmail Watch Routes (using GmailWebhookController)
router.post("/watch", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID not found" });
    }

    const result = await gmailWebhookController.setupGmailWatch(userId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error setting up Gmail watch:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/stop-watch", authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID not found" });
    }

    await gmailWebhookController.stopGmailWatch(userId);
    res.status(200).json({ success: true, message: "Gmail watch stopped successfully" });
  } catch (error) {
    console.error("Error stopping Gmail watch:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
