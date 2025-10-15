const express = require("express");
const router = express.Router();
const pagePermissionController = require("../../controller/rbacController/pagePermissionController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkPermission, checkSuperAdmin, attachUserPermissions } = require("../../middleware/permissionMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * /api/page-permissions:
 *   get:
 *     summary: Get all page permissions
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Page permissions retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/", checkPermission("page_permissions.view"), pagePermissionController.getAllPagePermissions);

/**
 * @swagger
 * /api/page-permissions/category/{category}:
 *   get:
 *     summary: Get page permissions by category
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Page category
 *     responses:
 *       200:
 *         description: Page permissions retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/category/:category", checkPermission("page_permissions.view"), pagePermissionController.getPagePermissionsByCategory);

/**
 * @swagger
 * /api/page-permissions/{id}:
 *   get:
 *     summary: Get page permission by ID
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Page permission ID
 *     responses:
 *       200:
 *         description: Page permission retrieved successfully
 *       404:
 *         description: Page permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/:id", checkPermission("page_permissions.view"), pagePermissionController.getPagePermissionById);

/**
 * @swagger
 * /api/page-permissions:
 *   post:
 *     summary: Create new page permission
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - page_path
 *               - page_name
 *               - page_category
 *             properties:
 *               page_path:
 *                 type: string
 *               page_name:
 *                 type: string
 *               page_category:
 *                 type: string
 *               required_permission:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *               sort_order:
 *                 type: integer
 *               icon:
 *                 type: string
 *               parent_page_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Page permission created successfully
 *       400:
 *         description: Bad request
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.post("/", checkSuperAdmin, pagePermissionController.createPagePermission);

/**
 * @swagger
 * /api/page-permissions/{id}:
 *   put:
 *     summary: Update page permission
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Page permission ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               page_path:
 *                 type: string
 *               page_name:
 *                 type: string
 *               page_category:
 *                 type: string
 *               required_permission:
 *                 type: string
 *               is_public:
 *                 type: boolean
 *               is_active:
 *                 type: boolean
 *               sort_order:
 *                 type: integer
 *               icon:
 *                 type: string
 *               parent_page_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Page permission updated successfully
 *       400:
 *         description: Bad request
 *       404:
 *         description: Page permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.put("/:id", checkSuperAdmin, pagePermissionController.updatePagePermission);

/**
 * @swagger
 * /api/page-permissions/{id}:
 *   delete:
 *     summary: Delete page permission
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Page permission ID
 *     responses:
 *       200:
 *         description: Page permission deleted successfully
 *       404:
 *         description: Page permission not found
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.delete("/:id", checkSuperAdmin, pagePermissionController.deletePagePermission);

/**
 * @swagger
 * /api/page-permissions/accessible/me:
 *   get:
 *     summary: Get accessible pages for current user
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Accessible pages retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/accessible/me", attachUserPermissions, pagePermissionController.getAccessiblePagesForCurrentUser);

/**
 * @swagger
 * /api/page-permissions/accessible/user/{userId}:
 *   get:
 *     summary: Get accessible pages for specific user
 *     tags: [Page Permissions]
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
 *         description: Accessible pages retrieved successfully
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/accessible/user/:userId", checkPermission("page_permissions.view"), pagePermissionController.getAccessiblePagesForUser);

/**
 * @swagger
 * /api/page-permissions/check/{pagePath}:
 *   get:
 *     summary: Check if current user can access specific page
 *     tags: [Page Permissions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: pagePath
 *         required: true
 *         schema:
 *           type: string
 *         description: Page path (URL encoded)
 *     responses:
 *       200:
 *         description: Page access check completed
 *       403:
 *         description: Access denied
 *       500:
 *         description: Server error
 */
router.get("/check/:pagePath", pagePermissionController.canCurrentUserAccessPage);



module.exports = router;
