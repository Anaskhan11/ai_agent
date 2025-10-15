const express = require("express");
const knowledgeBasesController = require("../../controller/KnowledgeBasesController/KnowledgeBasesController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all knowledge bases
router.get("/", authMiddleware, knowledgeBasesController.listKnowledgeBases);

// Get knowledge base by ID
router.get("/:id", authMiddleware, knowledgeBasesController.getKnowledgeBase);

// Create knowledge base
router.post("/", authMiddleware, knowledgeBasesController.createKnowledgeBase);

// Update knowledge base
router.patch("/:id", authMiddleware, knowledgeBasesController.updateKnowledgeBase);

// Delete knowledge base
router.delete("/:id", authMiddleware, knowledgeBasesController.deleteKnowledgeBase);

// Search knowledge base
router.post("/:id/search", authMiddleware, knowledgeBasesController.searchKnowledgeBase);

// Get knowledge base statistics
router.get("/:id/stats", authMiddleware, knowledgeBasesController.getKnowledgeBaseStats);

module.exports = router;
