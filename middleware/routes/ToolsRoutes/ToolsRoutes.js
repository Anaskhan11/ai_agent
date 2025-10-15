const express = require("express");
const toolsController = require("../../controller/ToolsController/ToolsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all tools
router.get("/", authMiddleware, toolsController.listTools);

// Get tool by ID
router.get("/:id", authMiddleware, toolsController.getTool);

// Create tool
router.post("/", authMiddleware, toolsController.createTool);

// Update tool
router.patch("/:id", authMiddleware, toolsController.updateTool);

// Delete tool
router.delete("/:id", authMiddleware, toolsController.deleteTool);

// Get tool templates
router.get("/templates/all", authMiddleware, toolsController.getToolTemplates);

module.exports = router;
