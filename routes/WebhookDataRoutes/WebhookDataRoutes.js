const express = require("express");
const webhookDataController = require("../../controller/WebhookDataController/WebhookDataController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Webhook data capture endpoint (public - no auth required)
// This is the endpoint that external services will POST data to
router.post("/capture/:webhookId", webhookDataController.storeWebhookData);

// Test webhook endpoint (requires auth) - for testing webhook workflows
router.post("/test/:webhookId", authMiddleware, webhookDataController.testWebhookData);

// Get webhook data history (requires auth)
router.get("/history/:webhookId", authMiddleware, webhookDataController.getWebhookData);

// Get webhook data for capture functionality (public - no auth required)
// This is used by the frontend webhook capture feature to show captured data
router.get("/capture/:webhookId/history", webhookDataController.getWebhookData);

// List storage webhook endpoint (public - no auth required)
// This is the second webhook that stores data in lists
router.post("/list-storage/:webhookId", webhookDataController.handleListStorageWebhook);

module.exports = router;
