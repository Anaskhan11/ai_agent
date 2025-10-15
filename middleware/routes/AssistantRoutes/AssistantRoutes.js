const express = require("express");
const assistantController = require("../../controller/AssistantController/AssistantController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/assistant/create_assistant:
 *   post:
 *     summary: Create a new AI assistant
 *     description: Create a new AI assistant with custom configuration for transcriber, model, and voice
 *     tags: [Assistants]
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
 *               - firstMessage
 *               - transcriber
 *               - model
 *               - voice
 *             properties:
 *               name:
 *                 type: string
 *                 example: Customer Support Assistant
 *                 description: Name of the assistant
 *               firstMessage:
 *                 type: string
 *                 example: Hello! How can I help you today?
 *                 description: First message the assistant will say
 *               transcriber:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     example: deepgram
 *                   model:
 *                     type: string
 *                     example: nova-2
 *                   confidenceThreshold:
 *                     type: number
 *                     example: 0.5
 *               model:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     example: openai
 *                   model:
 *                     type: string
 *                     example: gpt-4o
 *                   temperature:
 *                     type: number
 *                     example: 0.7
 *               voice:
 *                 type: object
 *                 properties:
 *                   provider:
 *                     type: string
 *                     example: 11labs
 *                   voiceId:
 *                     type: string
 *                     example: sarah
 *     responses:
 *       201:
 *         description: Assistant created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Assistant'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

router.post(
  "/create_assistant",
  authMiddleware,
  assistantController.createAssistant
);

/**
 * @swagger
 * /api/assistant/get_all_assistants:
 *   get:
 *     summary: Get all assistants
 *     description: Retrieve all assistants with pagination and search functionality
 *     tags: [Assistants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for assistant names
 *     responses:
 *       200:
 *         description: Assistants retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Assistant'
 *                 totalAssistant:
 *                   type: integer
 *                   example: 25
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 3
 *       404:
 *         description: No assistants found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/get_all_assistants",
  authMiddleware,
  assistantController.getAssistants
);

/**
 * @swagger
 * /api/assistant/get-assistants/{id}:
 *   get:
 *     summary: Get assistant by ID
 *     description: Retrieve a specific assistant from VAPI by ID
 *     tags: [Assistants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assistant ID
 *     responses:
 *       200:
 *         description: Assistant retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/Assistant'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Assistant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/get-assistants/:id",
  authMiddleware,
  assistantController.getAssistantsFromVapi
);

/**
 * @swagger
 * /api/assistant/list-all-assistants-from-vapi:
 *   get:
 *     summary: List all assistants from VAPI
 *     description: Retrieve all assistants directly from VAPI API
 *     tags: [Assistants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All assistants retrieved successfully from VAPI
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: All assistants retrieved successfully from VAPI
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Assistant'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Failed to fetch assistants from VAPI
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/list-all-assistants-from-vapi",
  authMiddleware,
  assistantController.listAllAssistantsFromVapi
);

router.put(
  "/update-assistant/:id",
  authMiddleware,
  assistantController.updateAssistant
);

router.get(
  "/get-synced-assistants",
  authMiddleware,
  assistantController.getSyncedAssistants
);

/**
 * @swagger
 * /api/assistant/delete-assistant/{id}:
 *   delete:
 *     summary: Delete assistant
 *     description: Delete an assistant from VAPI and local database
 *     tags: [Assistants]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Assistant ID to delete
 *     responses:
 *       200:
 *         description: Assistant deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       404:
 *         description: Assistant not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  "/delete-assistant/:id",
  authMiddleware,
  assistantController.deleteAssistant
);

module.exports = router;
