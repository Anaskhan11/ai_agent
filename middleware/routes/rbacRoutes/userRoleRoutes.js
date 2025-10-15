const express = require("express");
const router = express.Router();
const userRoleController = require("../../controller/rbacController/userRoleController");
const authMiddleware = require("../../middleware/authMiddleware");

// Get all user roles
router.get("/", authMiddleware, userRoleController.getAllUserRoles);

// Get user roles by user ID
router.get("/user/:userId", authMiddleware, userRoleController.getUserRoles);

// Get users by role ID
router.get("/role/:roleId", authMiddleware, userRoleController.getUsersByRole);

// Assign role to user
router.post("/user/:userId/role/:roleId", authMiddleware, userRoleController.assignRoleToUser);

// Remove role from user
router.delete("/user/:userId/role/:roleId", authMiddleware, userRoleController.removeRoleFromUser);

// Bulk assign roles to user
router.put("/user/:userId/roles", authMiddleware, userRoleController.bulkAssignRolesToUser);

// Get user comprehensive permissions
router.get("/user/:userId/permissions", authMiddleware, userRoleController.getUserComprehensivePermissions);

// Check if user has specific role
router.get("/user/:userId/role/:roleName/check", authMiddleware, userRoleController.checkUserRole);

// Get expired user roles
router.get("/expired", authMiddleware, userRoleController.getExpiredUserRoles);

// Clean up expired roles
router.post("/cleanup-expired", authMiddleware, userRoleController.cleanupExpiredRoles);

module.exports = router;
