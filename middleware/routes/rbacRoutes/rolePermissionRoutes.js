const express = require("express");
const router = express.Router();
const rolePermissionController = require("../../controller/rbacController/rolePermissionController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkPermission, checkSuperAdmin } = require("../../middleware/permissionMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/role-permissions:
 *   get:
 *     summary: Get all role permissions
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role permissions retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/", checkPermission("role_permissions.view"), rolePermissionController.getAllRolePermissions);

/**
 * @swagger
 * /api/role-permissions/role/{roleId}:
 *   get:
 *     summary: Get permissions for a specific role
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     responses:
 *       200:
 *         description: Role permissions retrieved successfully
 *       404:
 *         description: Role not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/role/:roleId", checkPermission("role_permissions.view"), rolePermissionController.getRolePermissionsByRoleId);

/**
 * @swagger
 * /api/role-permissions/role/{roleId}/permission/{permissionId}:
 *   post:
 *     summary: Grant permission to role
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Permission granted to role successfully
 *       400:
 *         description: Permission already granted
 *       404:
 *         description: Role or permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post("/role/:roleId/permission/:permissionId", checkSuperAdmin, rolePermissionController.grantPermissionToRole);

/**
 * @swagger
 * /api/role-permissions/role/{roleId}/permission/{permissionId}:
 *   delete:
 *     summary: Revoke permission from role
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Permission revoked from role successfully
 *       404:
 *         description: Role, permission, or role permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.delete("/role/:roleId/permission/:permissionId", checkSuperAdmin, rolePermissionController.revokePermissionFromRole);

/**
 * @swagger
 * /api/role-permissions/role/{roleId}/bulk:
 *   post:
 *     summary: Bulk grant permissions to role
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - permissionIds
 *             properties:
 *               permissionIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: Array of permission IDs to grant
 *     responses:
 *       200:
 *         description: Permissions granted to role successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Role or permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post("/role/:roleId/bulk", checkSuperAdmin, rolePermissionController.bulkUpdateRolePermissions);

/**
 * @swagger
 * /api/role-permissions/role/{roleId}/check/{permissionName}:
 *   get:
 *     summary: Check if role has specific permission
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roleId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Role ID
 *       - in: path
 *         name: permissionName
 *         required: true
 *         schema:
 *           type: string
 *         description: Permission name
 *     responses:
 *       200:
 *         description: Permission check completed
 *       404:
 *         description: Role not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/role/:roleId/check/:permissionName", checkPermission("role_permissions.view"), rolePermissionController.checkRolePermission);

/**
 * @swagger
 * /api/role-permissions/permission/{permissionId}/roles:
 *   get:
 *     summary: Get roles with specific permission
 *     tags: [Role Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Roles with permission retrieved successfully
 *       404:
 *         description: Permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/permission/:permissionId/roles", checkPermission("role_permissions.view"), rolePermissionController.getRolesWithPermission);

module.exports = router;
