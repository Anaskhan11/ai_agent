const express = require("express");
const router = express.Router();
const rolePagePermissionController = require("../../controller/rbacController/rolePagePermissionController");
const authMiddleware = require("../../middleware/authMiddleware");

// Get all role page permissions
router.get("/", authMiddleware, rolePagePermissionController.getAllRolePagePermissions);

// Get role page permissions by role ID
router.get("/role/:roleId", authMiddleware, rolePagePermissionController.getRolePagePermissions);

// Get accessible pages by role ID
router.get("/role/:roleId/accessible-pages", authMiddleware, rolePagePermissionController.getAccessiblePagesByRole);

// Set role page permissions (bulk update)
router.put("/role/:roleId", authMiddleware, rolePagePermissionController.setRolePagePermissions);

// Get user page permissions (through roles)
router.get("/user/:userId", authMiddleware, rolePagePermissionController.getUserPagePermissions);

// Get all pages for role management
router.get("/pages", authMiddleware, rolePagePermissionController.getAllPagesForRoleManagement);

// Check role page permission
router.get("/role/:roleId/page/:pageId/permission/:permissionType", authMiddleware, rolePagePermissionController.checkRolePagePermission);

// Delete role page permission
router.delete("/role/:roleId/page/:pageId", authMiddleware, rolePagePermissionController.deleteRolePagePermission);

module.exports = router;
