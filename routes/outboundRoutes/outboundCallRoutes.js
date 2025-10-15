const express = require("express");
const outboundCall = require("../../controller/outboundCallController/outboundCall");
const outboundCampaign = require("../../controller/outboundCampaignController/outboundCampaign");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkCredits, deductCredits } = require("../../middleware/creditMiddleware");

const router = express.Router();

// Outbound Calls Routes
router.post("/createCall", authMiddleware, outboundCall.createCall);
router.get("/getAllCalls", authMiddleware, outboundCall.getAllCalls);
router.get("/getCallsbyID/:id", authMiddleware, outboundCall.getCallsbyID);
router.post("/endCall/:id", authMiddleware, outboundCall.endCall);
router.get("/transcript/:id", authMiddleware, outboundCall.getCallTranscript);
router.get("/stats", authMiddleware, outboundCall.getCallStats);
router.post("/createBulkCalls", authMiddleware, outboundCall.createBulkCalls);
router.post("/schedule", authMiddleware, outboundCall.scheduleCall);
router.get("/recording/:id", authMiddleware, outboundCall.getCallRecording);
// Public proxy endpoint for audio streaming (no auth required for HTML audio elements)
router.get("/recording/:id/proxy", outboundCall.proxyRecording);
router.post("/recording/:id/sync", authMiddleware, outboundCall.syncCallRecording);
router.post("/recordings/sync-all", authMiddleware, outboundCall.syncAllRecordings);
router.get("/contact/:phoneNumber/history", authMiddleware, outboundCall.getContactCallHistory);

// Simple VAPI-only endpoints for campaign calls
router.get("/campaign-recording/:id", authMiddleware, outboundCall.getCampaignCallRecording);
router.get("/campaign-transcript/:id", authMiddleware, outboundCall.getCampaignCallTranscript);

// Outbound Campaigns Routes
router.get("/campaigns", authMiddleware, outboundCampaign.getAllCampaigns);
router.post("/campaigns", authMiddleware, checkCredits('campaign_creation', 'per_campaign', 1), deductCredits('id'), outboundCampaign.createCampaign);
router.get("/campaigns/:id", authMiddleware, outboundCampaign.getCampaignById);
router.patch("/campaigns/:id", authMiddleware, outboundCampaign.updateCampaign);
router.delete("/campaigns/:id", authMiddleware, outboundCampaign.deleteCampaign);
router.get("/campaigns/:id/calls", authMiddleware, outboundCampaign.getCampaignCalls);
router.post("/campaigns/:id/launch", authMiddleware, checkCredits('campaign_launch', 'per_launch', 1), deductCredits('id'), outboundCampaign.launchCampaign);
router.post("/campaigns/:id/pause", authMiddleware, outboundCampaign.pauseCampaign);
router.post("/campaigns/:id/resume", authMiddleware, outboundCampaign.resumeCampaign);
router.post("/campaigns/:id/cancel", authMiddleware, outboundCampaign.cancelCampaign);
router.get("/test-vapi", authMiddleware, outboundCampaign.testVapiConnection);

module.exports = router;
