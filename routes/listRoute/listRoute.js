const express = require("express");
const router = express.Router();
const listController = require("../../controller/listController/listController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkCredits } = require("../../middleware/creditMiddleware");

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     List:
 *       type: object
 *       required:
 *         - list_name
 *         - list_description
 *       properties:
 *         id:
 *           type: integer
 *           description: The auto-generated id of the list
 *         list_name:
 *           type: string
 *           description: The name of the list
 *         list_description:
 *           type: string
 *           description: The description of the list
 *         type:
 *           type: string
 *           enum: [Marketing, Sales, Event, Customer, General]
 *           description: The type/category of the list
 *         contacts_count:
 *           type: integer
 *           description: Number of contacts in the list
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: The date the list was created
 *         updated_at:
 *           type: string
 *           format: date-time
 *           description: The date the list was last updated
 *         user_id:
 *           type: integer
 *           description: The ID of the user who owns the list
 */

/**
 * @swagger
 * /api/lists:
 *   get:
 *     summary: Get all lists for the authenticated user
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering lists
 *     responses:
 *       200:
 *         description: Lists retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/List'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalLists:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", listController.getAllLists);

/**
 * @swagger
 * /api/lists/{id}:
 *   get:
 *     summary: Get a specific list by ID
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The list ID
 *     responses:
 *       200:
 *         description: List retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/List'
 *       404:
 *         description: List not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id", listController.getListById);

/**
 * @swagger
 * /api/lists:
 *   post:
 *     summary: Create a new list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - list_name
 *               - list_description
 *             properties:
 *               list_name:
 *                 type: string
 *               list_description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [Marketing, Sales, Event, Customer, General]
 *                 default: General
 *     responses:
 *       201:
 *         description: List created successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", checkCredits('contact_list_creation', 'per_operation', 1), listController.createList);

/**
 * @swagger
 * /api/lists/{id}:
 *   put:
 *     summary: Update a list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The list ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               list_name:
 *                 type: string
 *               list_description:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [Marketing, Sales, Event, Customer, General]
 *     responses:
 *       200:
 *         description: List updated successfully
 *       404:
 *         description: List not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.put("/:id", listController.updateList);

/**
 * @swagger
 * /api/lists/{id}:
 *   delete:
 *     summary: Delete a list (soft delete - disables the list)
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The list ID
 *     responses:
 *       200:
 *         description: List disabled successfully
 *       404:
 *         description: List not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/:id", listController.deleteList);

/**
 * @swagger
 * /api/lists/{id}/restore:
 *   patch:
 *     summary: Restore a soft deleted list (super admin only)
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The list ID
 *     responses:
 *       200:
 *         description: List restored successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Access denied - Super admin privileges required
 *       404:
 *         description: List not found or not deleted
 *       500:
 *         description: Server error
 */
router.patch("/:id/restore", listController.restoreList);

/**
 * @swagger
 * /api/lists/{id}/contacts:
 *   get:
 *     summary: Get all contacts in a specific list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The list ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for filtering contacts
 *     responses:
 *       200:
 *         description: Contacts retrieved successfully
 *       404:
 *         description: List not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/:id/contacts", listController.getListContacts);

/**
 * @swagger
 * /api/lists/{id}/contacts:
 *   post:
 *     summary: Add a contact to a specific list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The list ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - contact_number
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               contact_number:
 *                 type: string
 *               first_name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Contact added successfully
 *       400:
 *         description: Invalid input data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/:id/contacts", listController.addContactToList);

/**
 * @swagger
 * /api/lists/{id}/contacts/{contactId}:
 *   delete:
 *     summary: Remove a contact from a specific list
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The list ID
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The contact ID
 *     responses:
 *       200:
 *         description: Contact removed successfully
 *       404:
 *         description: Contact or list not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.delete("/:id/contacts/:contactId", listController.removeContactFromList);

/**
 * @swagger
 * /api/lists/stats:
 *   get:
 *     summary: Get list statistics for the authenticated user
 *     tags: [Lists]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/stats", listController.getListStats);

module.exports = router;
