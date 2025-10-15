const express = require("express");
const recordingsController = require("../../controller/RecordingsController/RecordingsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all recordings
router.get("/", authMiddleware, recordingsController.listRecordings);

// Get recording by ID
router.get("/:id", authMiddleware, recordingsController.getRecording);

// Upload recording
router.post("/upload", authMiddleware, recordingsController.uploadRecording);

// Update recording
router.patch("/:id", authMiddleware, recordingsController.updateRecording);

// Delete recording
router.delete("/:id", authMiddleware, recordingsController.deleteRecording);

// Stream recording audio (requires auth for real recordings)
router.get("/:id/stream", authMiddleware, recordingsController.streamRecording);

// Public demo recording stream (no auth required for demo recordings)
router.get("/demo_:id/stream", recordingsController.streamRecording);

// Download recording
router.get("/:id/download", authMiddleware, recordingsController.downloadRecording);

// Get recording transcript
router.get("/:id/transcript", authMiddleware, recordingsController.getRecordingTranscript);

// Update recording transcript
router.patch("/:id/transcript", authMiddleware, recordingsController.updateRecordingTranscript);

// Get recording analytics
router.get("/:id/analytics", authMiddleware, recordingsController.getRecordingAnalytics);

// Share recording
router.post("/:id/share", authMiddleware, recordingsController.shareRecording);

// Get recording metadata
router.get("/:id/metadata", authMiddleware, recordingsController.getRecordingMetadata);

module.exports = router;
