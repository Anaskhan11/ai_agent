const express = require("express");
const webhookTestController = require("../../controller/WebhookTestController/WebhookTestController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Simulate Facebook lead webhook (requires auth)
router.post("/simulate/facebook-lead", authMiddleware, webhookTestController.simulateFacebookLead);

// Test complete webhook flow (requires auth)
router.post("/flow/complete", authMiddleware, webhookTestController.testCompleteWebhookFlow);

module.exports = router;
