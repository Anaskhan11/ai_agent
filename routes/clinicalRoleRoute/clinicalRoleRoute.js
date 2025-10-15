const express = require("express");
const router = express.Router();
const clinicalRoleController = require("../../controller/clinicalRoleController/clinicalRoleController");
const authMiddleware = require("../../middleware/authMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Clinical role CRUD routes
router.get("/", clinicalRoleController.getAllClinicalRoles);
router.get("/stats", clinicalRoleController.getClinicalRoleStats);
router.get("/:id", clinicalRoleController.getClinicalRoleById);
router.post("/", clinicalRoleController.createClinicalRole);
router.put("/:id", clinicalRoleController.updateClinicalRole);
router.delete("/:id", clinicalRoleController.deleteClinicalRole);

// User-role assignment routes
router.get("/:id/users", clinicalRoleController.getUsersWithRole);
router.post("/:roleId/users/:userId", clinicalRoleController.assignRoleToUser);
router.delete("/:roleId/users/:userId", clinicalRoleController.removeRoleFromUser);

module.exports = router;
