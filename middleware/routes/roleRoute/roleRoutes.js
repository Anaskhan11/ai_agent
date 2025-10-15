// routes/roleRoutes.js
const express = require("express");
const router = express.Router();
const roleController = require("../../controller/roleController/roleController");
const authMiddleware = require("../../middleware/authMiddleware");

// Protected routes
router.post("/", authMiddleware, roleController.createRole);
router.get("/", authMiddleware, roleController.getAllRoles);
router.get("/:id", authMiddleware, roleController.getRoleById);
router.put("/:id", authMiddleware, roleController.updateRole);
router.delete("/:id", authMiddleware, roleController.deleteRole);

module.exports = router;
