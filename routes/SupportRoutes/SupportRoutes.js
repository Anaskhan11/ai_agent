const express = require("express");
const supportController = require("../../controller/SupportController/SupportController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * @swagger
 * components:
 *   schemas:
 *     SupportTicket:
 *       type: object
 *       required:
 *         - title
 *         - description
 *       properties:
 *         id:
 *           type: integer
 *           description: Auto-generated ticket ID
 *         ticket_id:
 *           type: string
 *           description: Unique ticket identifier
 *         title:
 *           type: string
 *           maxLength: 500
 *           description: Ticket title
 *         description:
 *           type: string
 *           description: Detailed description of the issue
 *         category:
 *           type: string
 *           enum: [technical, billing, feature_request, bug_report, general]
 *           default: general
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           default: medium
 *         status:
 *           type: string
 *           enum: [open, in_progress, waiting_response, resolved, closed]
 *           default: open
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *         created_at:
 *           type: string
 *           format: date-time
 *         updated_at:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /api/support/tickets:
 *   get:
 *     summary: Get all support tickets for the authenticated user
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, waiting_response, resolved, closed]
 *         description: Filter by ticket status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [technical, billing, feature_request, bug_report, general]
 *         description: Filter by ticket category
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by ticket priority
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title and description
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Limit number of results
 *     responses:
 *       200:
 *         description: Support tickets retrieved successfully
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
 *                     $ref: '#/components/schemas/SupportTicket'
 *                 count:
 *                   type: integer
 */
router.get("/tickets", supportController.getAllSupportTickets);

/**
 * @swagger
 * /api/support/tickets/{ticketId}:
 *   get:
 *     summary: Get support ticket by ID
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Support ticket retrieved successfully
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
 *                   $ref: '#/components/schemas/SupportTicket'
 *       404:
 *         description: Support ticket not found
 */
router.get("/tickets/:ticketId", supportController.getSupportTicketById);

/**
 * @swagger
 * /api/support/tickets:
 *   post:
 *     summary: Create a new support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 500
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [technical, billing, feature_request, bug_report, general]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Support ticket created successfully
 *       400:
 *         description: Invalid input data
 */
router.post("/tickets", supportController.createSupportTicket);

/**
 * @swagger
 * /api/support/tickets/{ticketId}:
 *   put:
 *     summary: Update support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 maxLength: 500
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [technical, billing, feature_request, bug_report, general]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, waiting_response, resolved, closed]
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Support ticket updated successfully
 *       404:
 *         description: Support ticket not found
 */
router.put("/tickets/:ticketId", supportController.updateSupportTicket);

/**
 * @swagger
 * /api/support/tickets/{ticketId}:
 *   delete:
 *     summary: Delete support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Support ticket deleted successfully
 *       404:
 *         description: Support ticket not found
 */
router.delete("/tickets/:ticketId", supportController.deleteSupportTicket);

/**
 * @swagger
 * /api/support/tickets/{ticketId}/messages:
 *   get:
 *     summary: Get messages for a support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Ticket messages retrieved successfully
 */
router.get("/tickets/:ticketId/messages", supportController.getTicketMessages);

/**
 * @swagger
 * /api/support/tickets/{ticketId}/messages:
 *   post:
 *     summary: Add message to support ticket
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Message added successfully
 */
router.post("/tickets/:ticketId/messages", supportController.addTicketMessage);

/**
 * @swagger
 * /api/support/categories:
 *   get:
 *     summary: Get all support categories
 *     tags: [Support]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support categories retrieved successfully
 */
router.get("/categories", supportController.getSupportCategories);

// ============ ADMIN ROUTES ============

/**
 * @swagger
 * /api/support/admin/tickets:
 *   get:
 *     summary: Get all support tickets for admin (no user isolation)
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, in_progress, waiting_response, resolved, closed]
 *         description: Filter by ticket status
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [technical, billing, feature_request, bug_report, general]
 *         description: Filter by ticket category
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *         description: Filter by ticket priority
 *       - in: query
 *         name: assigned_to
 *         schema:
 *           type: integer
 *         description: Filter by assigned staff member ID
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by user ID who created the ticket
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in title, description, ticket ID, user email, or user name
 *       - in: query
 *         name: created_from
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets created from this date
 *       - in: query
 *         name: created_to
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter tickets created until this date
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           enum: [created_at, updated_at, priority, status, title]
 *         description: Sort field
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of tickets per page
 *     responses:
 *       200:
 *         description: Support tickets retrieved successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 */
router.get("/admin/tickets", supportController.getAllSupportTicketsForAdmin);

/**
 * @swagger
 * /api/support/admin/tickets/{ticketId}:
 *   get:
 *     summary: Get support ticket by ID for admin (no user isolation)
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     responses:
 *       200:
 *         description: Support ticket retrieved successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 *       404:
 *         description: Support ticket not found
 */
router.get("/admin/tickets/:ticketId", supportController.getSupportTicketByIdForAdmin);

/**
 * @swagger
 * /api/support/admin/tickets/{ticketId}/assign:
 *   put:
 *     summary: Assign ticket to support staff
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - assigned_to
 *             properties:
 *               assigned_to:
 *                 type: integer
 *                 description: ID of the staff member to assign the ticket to
 *     responses:
 *       200:
 *         description: Ticket assigned successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 *       404:
 *         description: Support ticket not found
 */
router.put("/admin/tickets/:ticketId/assign", supportController.assignTicketToStaff);

/**
 * @swagger
 * /api/support/admin/tickets/{ticketId}/status:
 *   put:
 *     summary: Update ticket status by admin
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: ticketId
 *         required: true
 *         schema:
 *           type: string
 *         description: Ticket ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [open, in_progress, waiting_response, resolved, closed]
 *                 description: New status for the ticket
 *               notes:
 *                 type: string
 *                 description: Optional notes about the status change
 *     responses:
 *       200:
 *         description: Ticket status updated successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 *       404:
 *         description: Support ticket not found
 */
router.put("/admin/tickets/:ticketId/status", supportController.updateTicketStatusByAdmin);

/**
 * @swagger
 * /api/support/admin/stats:
 *   get:
 *     summary: Get support ticket statistics for admin dashboard
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support ticket statistics retrieved successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 */
router.get("/admin/stats", supportController.getSupportTicketStats);

/**
 * @swagger
 * /api/support/admin/stats/category:
 *   get:
 *     summary: Get ticket count by category for admin
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Ticket count by category retrieved successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 */
router.get("/admin/stats/category", supportController.getTicketCountByCategory);

/**
 * @swagger
 * /api/support/admin/activity:
 *   get:
 *     summary: Get recent ticket activity for admin dashboard
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of recent activities to retrieve
 *     responses:
 *       200:
 *         description: Recent ticket activity retrieved successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 */
router.get("/admin/activity", supportController.getRecentTicketActivity);

/**
 * @swagger
 * /api/support/admin/staff:
 *   get:
 *     summary: Get all support staff
 *     tags: [Support Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Support staff retrieved successfully
 *       403:
 *         description: Access denied - Super admin privileges required
 */
router.get("/admin/staff", supportController.getAllSupportStaff);

module.exports = router;
