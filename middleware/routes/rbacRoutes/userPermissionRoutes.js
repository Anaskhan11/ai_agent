const express = require("express");
const router = express.Router();
const userPermissionController = require("../../controller/rbacController/userPermissionController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkPermission, checkSuperAdmin } = require("../../middleware/permissionMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/user-permissions:
 *   get:
 *     summary: Get all user permissions
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User permissions retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/", checkPermission("user_permissions.view"), userPermissionController.getAllUserPermissions);

/**
 * @swagger
 * /api/user-permissions/user/{userId}:
 *   get:
 *     summary: Get permissions for a specific user
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User permissions retrieved successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/user/:userId", checkPermission("user_permissions.view"), userPermissionController.getUserPermissionsByUserId);

/**
 * @swagger
 * /api/user-permissions/user/{userId}/permission/{permissionId}:
 *   post:
 *     summary: Grant permission to user
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Permission expiration date
 *               reason:
 *                 type: string
 *                 description: Reason for granting permission
 *     responses:
 *       200:
 *         description: Permission granted to user successfully
 *       400:
 *         description: Permission already granted
 *       404:
 *         description: User or permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post("/user/:userId/permission/:permissionId", checkSuperAdmin, userPermissionController.grantPermissionToUser);

/**
 * @swagger
 * /api/user-permissions/user/{userId}/permission/{permissionId}:
 *   delete:
 *     summary: Revoke permission from user
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *       - in: path
 *         name: permissionId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for revoking permission
 *     responses:
 *       200:
 *         description: Permission revoked from user successfully
 *       404:
 *         description: User, permission, or user permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.delete("/user/:userId/permission/:permissionId", checkSuperAdmin, userPermissionController.revokePermissionFromUser);

/**
 * @swagger
 * /api/user-permissions/user/{userId}/bulk:
 *   post:
 *     summary: Bulk grant permissions to user
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
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
 *               expires_at:
 *                 type: string
 *                 format: date-time
 *                 description: Permission expiration date
 *               reason:
 *                 type: string
 *                 description: Reason for granting permissions
 *     responses:
 *       200:
 *         description: Permissions granted to user successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: User or permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post("/user/:userId/bulk", checkSuperAdmin, userPermissionController.bulkGrantPermissionsToUser);

/**
 * @swagger
 * /api/user-permissions/user/{userId}/check/{permissionName}:
 *   get:
 *     summary: Check if user has specific permission
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
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
 *         description: User not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/user/:userId/check/:permissionName", checkPermission("user_permissions.view"), userPermissionController.checkUserPermission);

/**
 * @swagger
 * /api/user-permissions/permission/{permissionId}/users:
 *   get:
 *     summary: Get users with specific permission
 *     tags: [User Permissions]
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
 *         description: Users with permission retrieved successfully
 *       404:
 *         description: Permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/permission/:permissionId/users", checkPermission("user_permissions.view"), userPermissionController.getUsersWithPermission);

/**
 * @swagger
 * /api/user-permissions/expired:
 *   get:
 *     summary: Get expired user permissions
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired user permissions retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/expired", checkSuperAdmin, userPermissionController.getExpiredUserPermissions);

/**
 * @swagger
 * /api/user-permissions/cleanup-expired:
 *   post:
 *     summary: Clean up expired permissions
 *     tags: [User Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Expired permissions cleaned up successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post("/cleanup-expired", checkSuperAdmin, userPermissionController.cleanupExpiredPermissions);

module.exports = router;
