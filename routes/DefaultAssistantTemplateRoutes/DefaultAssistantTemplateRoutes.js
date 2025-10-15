const express = require("express");
const router = express.Router();
const defaultAssistantTemplateController = require("../../controller/DefaultAssistantTemplateController/DefaultAssistantTemplateController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkPermission } = require("../../middleware/permissionMiddleware");

/**
 * @swagger
 * components:
 *   schemas:
 *     DefaultAssistantTemplate:
 *       type: object
 *       required:
 *         - name
 *         - description
 *       properties:
 *         template_id:
 *           type: string
 *           description: Unique template identifier
 *         name:
 *           type: string
 *           description: Template name
 *         description:
 *           type: string
 *           description: Template description
 *         category:
 *           type: string
 *           description: Template category
 *           default: General
 *         first_message:
 *           type: string
 *           description: First message from assistant
 *         system_message:
 *           type: string
 *           description: System message for the assistant
 *         model:
 *           type: object
 *           description: AI model configuration
 *         voice:
 *           type: object
 *           description: Voice configuration
 *         transcriber:
 *           type: object
 *           description: Transcriber configuration
 *         is_active:
 *           type: boolean
 *           description: Whether template is active
 *           default: true
 *         is_featured:
 *           type: boolean
 *           description: Whether template is featured
 *           default: false
 *         sort_order:
 *           type: integer
 *           description: Sort order for display
 *           default: 0
 *         usage_count:
 *           type: integer
 *           description: Number of times template has been used
 *           default: 0
 */

/**
 * @swagger
 * /api/default-assistant-templates:
 *   post:
 *     summary: Create a new default assistant template (Super Admin only)
 *     tags: [Default Assistant Templates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DefaultAssistantTemplate'
 *     responses:
 *       201:
 *         description: Template created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/DefaultAssistantTemplate'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super Admin access required
 */
router.post(
  "/",
  authMiddleware,
  checkPermission('default_assistants.manage'),
  defaultAssistantTemplateController.createDefaultAssistantTemplate
);

/**
 * @swagger
 * /api/default-assistant-templates:
 *   get:
 *     summary: Get all default assistant templates
 *     tags: [Default Assistant Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: is_active
 *         schema:
 *           type: boolean
 *         description: Filter by active status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: is_featured
 *         schema:
 *           type: boolean
 *         description: Filter by featured status
 *     responses:
 *       200:
 *         description: Templates retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DefaultAssistantTemplate'
 *                 count:
 *                   type: integer
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/",
  authMiddleware,
  defaultAssistantTemplateController.getAllDefaultAssistantTemplates
);

/**
 * @swagger
 * /api/default-assistant-templates/categories:
 *   get:
 *     summary: Get all template categories
 *     tags: [Default Assistant Templates]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       category:
 *                         type: string
 *                       count:
 *                         type: integer
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/categories",
  authMiddleware,
  defaultAssistantTemplateController.getTemplateCategories
);

/**
 * @swagger
 * /api/default-assistant-templates/{id}:
 *   get:
 *     summary: Get default assistant template by ID
 *     tags: [Default Assistant Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/DefaultAssistantTemplate'
 *       404:
 *         description: Template not found
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/:id",
  authMiddleware,
  defaultAssistantTemplateController.getDefaultAssistantTemplateById
);

/**
 * @swagger
 * /api/default-assistant-templates/{id}/use:
 *   post:
 *     summary: Use a template (get template data for assistant creation)
 *     tags: [Default Assistant Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template data retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   description: Assistant configuration data
 *                 template:
 *                   type: object
 *                   description: Template metadata
 *       404:
 *         description: Template not found
 *       400:
 *         description: Template is not active
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/:id/use",
  authMiddleware,
  defaultAssistantTemplateController.useTemplate
);

/**
 * @swagger
 * /api/default-assistant-templates/{id}:
 *   put:
 *     summary: Update default assistant template (Super Admin only)
 *     tags: [Default Assistant Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/DefaultAssistantTemplate'
 *     responses:
 *       200:
 *         description: Template updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/DefaultAssistantTemplate'
 *       404:
 *         description: Template not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super Admin access required
 */
router.put(
  "/:id",
  authMiddleware,
  checkPermission('default_assistants.manage'),
  defaultAssistantTemplateController.updateDefaultAssistantTemplate
);

/**
 * @swagger
 * /api/default-assistant-templates/{id}:
 *   delete:
 *     summary: Delete default assistant template (Super Admin only)
 *     tags: [Default Assistant Templates]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Template ID
 *     responses:
 *       200:
 *         description: Template deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Template not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Super Admin access required
 */
router.delete(
  "/:id",
  authMiddleware,
  checkPermission('default_assistants.manage'),
  defaultAssistantTemplateController.deleteDefaultAssistantTemplate
);

module.exports = router;
