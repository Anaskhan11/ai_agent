const express = require("express");
const modelsController = require("../../controller/ModelsController/ModelsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/models/available:
 *   get:
 *     summary: Get available AI models
 *     description: Retrieve all available AI models from different providers (OpenAI, Anthropic, Groq, etc.)
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available models retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         openai:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Model'
 *                         anthropic:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Model'
 *                         groq:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Model'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// Get available models
router.get("/available", authMiddleware, modelsController.getAvailableModels);

/**
 * @swagger
 * /api/models/config:
 *   post:
 *     summary: Create model configuration
 *     description: Create a new AI model configuration with custom parameters
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - model
 *             properties:
 *               provider:
 *                 type: string
 *                 example: openai
 *                 description: AI model provider
 *               model:
 *                 type: string
 *                 example: gpt-4o
 *                 description: Model identifier
 *               temperature:
 *                 type: number
 *                 example: 0.7
 *                 description: Model temperature (0-1)
 *               maxTokens:
 *                 type: integer
 *                 example: 1000
 *                 description: Maximum tokens to generate
 *               topP:
 *                 type: number
 *                 example: 1
 *                 description: Top-p sampling parameter
 *               frequencyPenalty:
 *                 type: number
 *                 example: 0
 *                 description: Frequency penalty (-2 to 2)
 *               presencePenalty:
 *                 type: number
 *                 example: 0
 *                 description: Presence penalty (-2 to 2)
 *               systemMessage:
 *                 type: string
 *                 example: You are a helpful AI assistant.
 *                 description: System message for the model
 *     responses:
 *       201:
 *         description: Model configuration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Bad request - missing required fields
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
// Create model configuration
router.post("/config", authMiddleware, modelsController.createModelConfig);

/**
 * @swagger
 * /api/models/test:
 *   post:
 *     summary: Test model configuration
 *     description: Test an AI model configuration with a sample message
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - provider
 *               - model
 *               - message
 *             properties:
 *               provider:
 *                 type: string
 *                 example: openai
 *               model:
 *                 type: string
 *                 example: gpt-4o
 *               message:
 *                 type: string
 *                 example: Hello, how are you?
 *               temperature:
 *                 type: number
 *                 example: 0.7
 *               maxTokens:
 *                 type: integer
 *                 example: 100
 *     responses:
 *       200:
 *         description: Model test completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Test model
router.post("/test", authMiddleware, modelsController.testModel);

/**
 * @swagger
 * /api/models/stats:
 *   get:
 *     summary: Get model usage statistics
 *     description: Retrieve usage statistics and analytics for AI models
 *     tags: [Models]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Model statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         totalRequests:
 *                           type: integer
 *                           example: 1250
 *                         totalTokens:
 *                           type: integer
 *                           example: 125000
 *                         averageResponseTime:
 *                           type: number
 *                           example: 850
 *                         topModels:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               model:
 *                                 type: string
 *                                 example: gpt-4o
 *                               usage:
 *                                 type: number
 *                                 example: 45
 *                               provider:
 *                                 type: string
 *                                 example: openai
 *                         costBreakdown:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                               example: 86.50
 */
// Get model statistics
router.get("/stats", authMiddleware, modelsController.getModelStats);

module.exports = router;
