const express = require("express");
const sessionsController = require("../../controller/SessionsController/SessionsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all sessions
router.get("/", authMiddleware, sessionsController.listSessions);

// Get session by ID
router.get("/:id", authMiddleware, sessionsController.getSession);

// Create session
router.post("/", authMiddleware, sessionsController.createSession);

// Update session
router.patch("/:id", authMiddleware, sessionsController.updateSession);

// Delete session
router.delete("/:id", authMiddleware, sessionsController.deleteSession);

// Get session messages
router.get("/:id/messages", authMiddleware, sessionsController.getSessionMessages);

// Get session statistics
router.get("/stats/overview", authMiddleware, sessionsController.getSessionStats);

module.exports = router;
