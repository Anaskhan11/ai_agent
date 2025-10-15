const express = require("express");
const router = express.Router();
const permissionController = require("../../controller/rbacController/permissionController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkPermission, checkSuperAdmin } = require("../../middleware/permissionMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/permissions:
 *   get:
 *     summary: Get all permissions
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/", checkPermission("permissions.view"), permissionController.getAllPermissions);

/**
 * @swagger
 * /api/permissions/category/{category}:
 *   get:
 *     summary: Get permissions by category
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Permission category
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/category/:category", checkPermission("permissions.view"), permissionController.getPermissionsByCategory);

/**
 * @swagger
 * /api/permissions/{id}:
 *   get:
 *     summary: Get permission by ID
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Permission retrieved successfully
 *       404:
 *         description: Permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/:id", checkPermission("permissions.view"), permissionController.getPermissionById);

/**
 * @swagger
 * /api/permissions:
 *   post:
 *     summary: Create new permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - display_name
 *               - category
 *               - resource
 *               - action
 *             properties:
 *               name:
 *                 type: string
 *               display_name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               resource:
 *                 type: string
 *               action:
 *                 type: string
 *               is_system_permission:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Permission created successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post("/", checkSuperAdmin, permissionController.createPermission);

/**
 * @swagger
 * /api/permissions/{id}:
 *   put:
 *     summary: Update permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               display_name:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               resource:
 *                 type: string
 *               action:
 *                 type: string
 *               is_active:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Permission updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.put("/:id", checkSuperAdmin, permissionController.updatePermission);

/**
 * @swagger
 * /api/permissions/{id}:
 *   delete:
 *     summary: Delete permission
 *     tags: [Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Permission ID
 *     responses:
 *       200:
 *         description: Permission deleted successfully
 *       400:
 *         description: Cannot delete system permissions
 *       404:
 *         description: Permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.delete("/:id", checkSuperAdmin, permissionController.deletePermission);

/**
 * @swagger
 * /api/permissions/role/{roleId}:
 *   get:
 *     summary: Get permissions for a specific role
 *     tags: [Permissions]
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
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/role/:roleId", checkPermission("permissions.view"), permissionController.getPermissionsByRoleId);

/**
 * @swagger
 * /api/permissions/user/{userId}:
 *   get:
 *     summary: Get permissions for a specific user
 *     tags: [Permissions]
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
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/user/:userId", checkPermission("permissions.view"), permissionController.getPermissionsByUserId);

// Get detailed user permissions (for dynamic permission checking)
router.get("/user/:userId/detailed", authMiddleware, permissionController.getUserPermissions);

module.exports = router;
