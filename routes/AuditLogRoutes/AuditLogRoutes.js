const express = require('express');
const auditLogController = require('../../controller/AuditLogController/AuditLogController');
const authMiddleware = require('../../middleware/authMiddleware');
const { checkPermission } = require('../../middleware/permissionMiddleware');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           description: Unique identifier for the audit log entry
 *         user_id:
 *           type: integer
 *           description: ID of the user who performed the action
 *         user_email:
 *           type: string
 *           description: Email of the user who performed the action
 *         user_name:
 *           type: string
 *           description: Name of the user who performed the action
 *         operation_type:
 *           type: string
 *           enum: [CREATE, UPDATE, DELETE, READ]
 *           description: Type of operation performed
 *         table_name:
 *           type: string
 *           description: Name of the database table affected
 *         record_id:
 *           type: string
 *           description: ID of the record affected
 *         old_values:
 *           type: object
 *           description: Previous values before the operation
 *         new_values:
 *           type: object
 *           description: New values after the operation
 *         changed_fields:
 *           type: array
 *           description: List of fields that were changed
 *         ip_address:
 *           type: string
 *           description: IP address of the client
 *         user_agent:
 *           type: string
 *           description: User agent string from the client
 *         request_method:
 *           type: string
 *           description: HTTP method used
 *         request_url:
 *           type: string
 *           description: URL that was requested
 *         response_status:
 *           type: integer
 *           description: HTTP response status code
 *         execution_time_ms:
 *           type: integer
 *           description: Time taken to execute the operation in milliseconds
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the audit log was created
 */

/**
 * @swagger
 * /api/audit-logs:
 *   get:
 *     summary: Get audit logs with filtering and pagination
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: user_email
 *         schema:
 *           type: string
 *         description: Filter by user email (partial match)
 *       - in: query
 *         name: operation_type
 *         schema:
 *           type: string
 *           enum: [CREATE, UPDATE, DELETE, READ]
 *         description: Filter by operation type
 *       - in: query
 *         name: table_name
 *         schema:
 *           type: string
 *         description: Filter by table name
 *       - in: query
 *         name: record_id
 *         schema:
 *           type: string
 *         description: Filter by record ID
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of records to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of records to skip
 *       - in: query
 *         name: sort_by
 *         schema:
 *           type: string
 *           default: created_at
 *         description: Field to sort by
 *       - in: query
 *         name: sort_order
 *         schema:
 *           type: string
 *           enum: [ASC, DESC]
 *           default: DESC
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Audit logs retrieved successfully
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
 *                     $ref: '#/components/schemas/AuditLog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
// Stats route must come before /:id route to avoid conflicts
/**
 * @swagger
 * /api/audit-logs/stats:
 *   get:
 *     summary: Get audit log statistics
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by start date
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter by end date
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: integer
 *         description: Filter by user ID
 *       - in: query
 *         name: table_name
 *         schema:
 *           type: string
 *         description: Filter by table name
 *     responses:
 *       200:
 *         description: Audit log statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/stats', authMiddleware, checkPermission('audit_logs.view'), auditLogController.getAuditLogStats);

// Export routes must come before /:id route to avoid conflicts
router.get('/export', authMiddleware, checkPermission('audit_logs.export'), auditLogController.exportAuditLogsToExcel);
router.post('/export/daily', authMiddleware, checkPermission('audit_logs.export'), auditLogController.createDailyExcelExport);

// Download route must come before /:id route to avoid conflicts
router.get('/download/:filename', authMiddleware, checkPermission('audit_logs.export'), auditLogController.downloadExportedFile);

// Cleanup route must come before /:id route to avoid conflicts
router.delete('/cleanup', authMiddleware, checkPermission('audit_logs.delete'), auditLogController.cleanupOldAuditLogs);

// Combined file route must come before /:id route to avoid conflicts
router.get('/combined', authMiddleware, checkPermission('audit_logs.view'), auditLogController.getCombinedFileContent);

// Main list route
router.get('/', authMiddleware, checkPermission('audit_logs.view'), auditLogController.getAuditLogs);

/**
 * @swagger
 * /api/audit-logs:
 *   post:
 *     summary: Create audit log entry
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               operation_type:
 *                 type: string
 *                 enum: [CREATE, UPDATE, DELETE, READ]
 *               table_name:
 *                 type: string
 *               record_id:
 *                 type: string
 *               old_values:
 *                 type: object
 *               new_values:
 *                 type: object
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Audit log created successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/', authMiddleware, auditLogController.createAuditLog);

/**
 * @swagger
 * /api/audit-logs/{id}:
 *   get:
 *     summary: Get audit log by ID
 *     tags: [Audit Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Audit log ID
 *     responses:
 *       200:
 *         description: Audit log retrieved successfully
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
 *                   $ref: '#/components/schemas/AuditLog'
 *       404:
 *         description: Audit log not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/:id', authMiddleware, checkPermission('audit_logs.view'), auditLogController.getAuditLogById);

module.exports = router;
