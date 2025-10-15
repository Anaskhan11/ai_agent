const express = require("express");
const transcribersController = require("../../controller/TranscribersController/TranscribersController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Get available transcribers
router.get("/available", authMiddleware, transcribersController.getAvailableTranscribers);

// Create transcriber configuration
router.post("/config", authMiddleware, transcribersController.createTranscriberConfig);

// Test transcriber
router.post("/test", authMiddleware, transcribersController.testTranscriber);

// Get transcriber statistics
router.get("/stats", authMiddleware, transcribersController.getTranscriberStats);

module.exports = router;
