const express = require("express");
const squadsController = require("../../controller/SquadsController/SquadsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all squads
router.get("/", authMiddleware, squadsController.listSquads);

// Get squad by ID
router.get("/:id", authMiddleware, squadsController.getSquad);

// Create squad
router.post("/", authMiddleware, squadsController.createSquad);

// Update squad
router.patch("/:id", authMiddleware, squadsController.updateSquad);

// Delete squad
router.delete("/:id", authMiddleware, squadsController.deleteSquad);

// Add member to squad
router.post("/:id/members", authMiddleware, squadsController.addMemberToSquad);

// Remove member from squad
router.delete("/:id/members/:memberId", authMiddleware, squadsController.removeMemberFromSquad);

module.exports = router;
