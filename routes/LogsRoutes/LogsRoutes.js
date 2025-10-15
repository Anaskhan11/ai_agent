const express = require("express");
const logsController = require("../../controller/LogsController/LogsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Get logs
router.get("/", authMiddleware, logsController.getLogs);

// Delete logs
router.delete("/", authMiddleware, logsController.deleteLogs);

// Get log statistics
router.get("/stats", authMiddleware, logsController.getLogStats);

// Export logs
router.get("/export", authMiddleware, logsController.exportLogs);

module.exports = router;
