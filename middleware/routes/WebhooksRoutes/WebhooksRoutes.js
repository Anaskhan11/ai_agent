const express = require("express");
const webhooksController = require("../../controller/WebhooksController/WebhooksController");
const authMiddleware = require("../../middleware/authMiddleware");
const GmailService = require("../../services/GmailService");
const systemAuditLogger = require("../../utils/systemAuditLogger");

const router = express.Router();

// Handle server message webhook (no auth middleware for webhooks from VAPI)
router.post("/server", webhooksController.handleServerMessage);

// Handle client message webhook (no auth middleware for webhooks from VAPI)
router.post("/client", webhooksController.handleClientMessage);

// Get webhook configuration (requires auth)
router.get("/config", authMiddleware, webhooksController.getWebhookConfig);

// Test webhook (requires auth)
router.post("/test", authMiddleware, webhooksController.testWebhook);

// Create general webhook endpoint (requires auth) - both routes for compatibility
router.post("/", authMiddleware, webhooksController.createWebhook);
router.post("/create", authMiddleware, webhooksController.createWebhook);

// Update webhook (requires auth) - for auto-save functionality
router.put("/:webhookId", authMiddleware, webhooksController.updateWebhook);

// List user webhooks (requires auth)
router.get("/", authMiddleware, webhooksController.listWebhooks);

// Update webhook configuration (requires auth) - MUST be before /:webhookId route
router.put("/:webhookId/config", authMiddleware, webhooksController.updateWebhookConfig);

// Get webhook logs (no auth for capture functionality) - MUST be before /:webhookId route
router.get("/:webhookId/logs", webhooksController.getWebhookLogs);

// Delete webhook (requires auth)
router.delete("/:webhookId", authMiddleware, webhooksController.deleteWebhook);

// Handle general webhook requests (no auth - public endpoint) - MUST be last
router.all("/:webhookId", webhooksController.handleGeneralWebhook);

// Facebook webhook endpoints (no auth - public endpoints)
router.get("/facebook", webhooksController.verifyFacebookWebhook);
router.post("/facebook", webhooksController.handleFacebookWebhook);

// Gmail OAuth callback endpoint
router.get("/gmail/callback", async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Handle OAuth error
    if (error) {
      console.error("Gmail OAuth error:", error);
      return res.redirect(`${process.env.FRONTEND_URL}/#/webhooks?gmail_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL}/#/webhooks?gmail_error=no_code`);
    }

    if (!state) {
      return res.redirect(`${process.env.FRONTEND_URL}/#/webhooks?gmail_error=no_state`);
    }

    // Parse state parameter
    let userId;
    let redirectPath = '/webhooks'; // Default fallback
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      userId = parseInt(stateData.userId);
      redirectPath = stateData.redirectPath || '/webhooks';
    } catch (e) {
      // Fallback: treat state as simple user ID
      userId = parseInt(state);
      console.warn('State parameter is not JSON, treating as simple user ID:', state);
    }

    if (!userId) {
      const separator = redirectPath.includes('?') ? '&' : '?';
      return res.redirect(`${process.env.FRONTEND_URL}/#${redirectPath}${separator}gmail_error=invalid_state`);
    }

    // Create Gmail service instance
    const gmailService = new GmailService();

    // Exchange code for tokens
    await gmailService.exchangeCodeForTokens(code, userId);

    // Get user profile to verify connection
    const profile = await gmailService.getUserProfile(userId);

    // Log successful Gmail connection
    await systemAuditLogger.logGmailOperation(req, 'CONNECT_GMAIL',
      { userId, email: profile.emailAddress }, true);

    // Redirect back to the specific webhook workflow page
    // Check if redirectPath already has query parameters
    const separator = redirectPath.includes('?') ? '&' : '?';
    const finalRedirectUrl = `${process.env.FRONTEND_URL}/#${redirectPath}${separator}gmail_success=true&email=${encodeURIComponent(profile.emailAddress)}`;
    res.redirect(finalRedirectUrl);
  } catch (error) {
    console.error("Error handling Gmail OAuth callback:", error);

    // Log failed Gmail connection
    try {
      await systemAuditLogger.logGmailOperation(req, 'CONNECT_GMAIL',
        { error: error.message }, false);
    } catch (logError) {
      console.error("Error logging failed Gmail connection:", logError);
    }

    // Redirect back to the specific webhook workflow page with error
    const errorMessage = error.message || 'Unknown error';
    const fallbackPath = redirectPath || '/webhooks';
    const separator = fallbackPath.includes('?') ? '&' : '?';
    res.redirect(`${process.env.FRONTEND_URL}/#${fallbackPath}${separator}gmail_error=${encodeURIComponent(errorMessage)}`);
  }
});

module.exports = router;
