const express = require("express");
const facebookController = require("../../controller/FacebookController/FacebookController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Get user's Facebook pages (fetches from Facebook API and stores in DB)
router.get("/pages", authMiddleware, facebookController.getUserPages);

// Get stored Facebook pages from database
router.get("/pages/stored", authMiddleware, facebookController.getStoredPages);

// Get lead forms for a specific page
router.get("/pages/:pageId/forms", authMiddleware, facebookController.getPageLeadForms);

// Get stored lead forms from database
router.get("/forms/stored/:pageId?", authMiddleware, facebookController.getStoredLeadForms);

// Get leads from a specific form
router.get("/forms/:formId/leads", authMiddleware, facebookController.getFormLeads);

// Subscribe to webhooks for a page
router.post("/webhooks/subscribe", authMiddleware, facebookController.subscribeToWebhooks);

// Test Facebook connection
router.get("/test-connection", authMiddleware, facebookController.testFacebookConnection);

module.exports = router;
