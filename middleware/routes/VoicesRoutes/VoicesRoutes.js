const express = require("express");
const voicesController = require("../../controller/VoicesController/VoicesController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

/**
 * @swagger
 * /api/voices/available:
 *   get:
 *     summary: Get available voices
 *     description: Retrieve all available text-to-speech voices from different providers
 *     tags: [Voices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [11labs, playht, azure, openai, deepgram]
 *         description: Filter voices by provider
 *     responses:
 *       200:
 *         description: Available voices retrieved successfully
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
 *                         11labs:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Voice'
 *                         playht:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Voice'
 *                         azure:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/Voice'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get available voices
router.get("/available", authMiddleware, voicesController.getAvailableVoices);

/**
 * @swagger
 * /api/voices/test:
 *   post:
 *     summary: Test voice
 *     description: Test a voice configuration with sample text
 *     tags: [Voices]
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
 *               - voiceId
 *               - text
 *             properties:
 *               provider:
 *                 type: string
 *                 example: 11labs
 *                 description: Voice provider
 *               voiceId:
 *                 type: string
 *                 example: sarah
 *                 description: Voice identifier
 *               text:
 *                 type: string
 *                 example: Hello, this is a test of the voice.
 *                 description: Text to synthesize
 *               speed:
 *                 type: number
 *                 example: 1
 *                 description: Speech speed (0.5-2.0)
 *               pitch:
 *                 type: number
 *                 example: 1
 *                 description: Voice pitch
 *               stability:
 *                 type: number
 *                 example: 0.5
 *                 description: Voice stability (0-1)
 *     responses:
 *       200:
 *         description: Voice test completed successfully
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
// Test voice
router.post("/test", authMiddleware, voicesController.testVoice);

/**
 * @swagger
 * /api/voices/config:
 *   post:
 *     summary: Create voice configuration
 *     description: Create a new voice configuration with custom parameters
 *     tags: [Voices]
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
 *               - voiceId
 *             properties:
 *               provider:
 *                 type: string
 *                 example: 11labs
 *               voiceId:
 *                 type: string
 *                 example: sarah
 *               speed:
 *                 type: number
 *                 example: 1
 *               pitch:
 *                 type: number
 *                 example: 1
 *               stability:
 *                 type: number
 *                 example: 0.5
 *               similarity:
 *                 type: number
 *                 example: 0.75
 *               style:
 *                 type: number
 *                 example: 0
 *               useCache:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Voice configuration created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */
// Create voice configuration
router.post("/config", authMiddleware, voicesController.createVoiceConfig);

/**
 * @swagger
 * /api/voices/stats:
 *   get:
 *     summary: Get voice usage statistics
 *     description: Retrieve usage statistics and analytics for text-to-speech voices
 *     tags: [Voices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Voice statistics retrieved successfully
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
 *                         totalCharacters:
 *                           type: integer
 *                           example: 125000
 *                         totalRequests:
 *                           type: integer
 *                           example: 850
 *                         averageResponseTime:
 *                           type: number
 *                           example: 650
 *                         topVoices:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               voiceId:
 *                                 type: string
 *                                 example: sarah
 *                               provider:
 *                                 type: string
 *                                 example: 11labs
 *                               usage:
 *                                 type: number
 *                                 example: 35
 */
// Get voice statistics
router.get("/stats", authMiddleware, voicesController.getVoiceStats);

/**
 * @swagger
 * /api/voices/preview/{provider}/{voiceId}:
 *   get:
 *     summary: Generate voice preview
 *     description: Generate a dynamic voice preview for the specified provider and voice
 *     tags: [Voices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *           enum: [11labs, playht, azure, openai]
 *         description: Voice provider
 *       - in: path
 *         name: voiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Voice identifier
 *       - in: query
 *         name: text
 *         schema:
 *           type: string
 *         description: Custom text for preview (optional)
 *     responses:
 *       200:
 *         description: Voice preview generated successfully
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
 *                         audioUrl:
 *                           type: string
 *                           description: URL to the generated audio file
 *                         provider:
 *                           type: string
 *                         voiceId:
 *                           type: string
 *                         text:
 *                           type: string
 *       400:
 *         description: Bad request - unsupported provider
 *       500:
 *         description: Internal server error
 */
// Generate voice preview
router.get("/preview/:provider/:voiceId", authMiddleware, voicesController.generateVoicePreview);

/**
 * @swagger
 * /api/voices/preview/vapi/{assistantId}:
 *   get:
 *     summary: Get VAPI voice preview audio
 *     description: Retrieve the generated audio for a VAPI assistant voice preview
 *     tags: [Voices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assistantId
 *         required: true
 *         schema:
 *           type: string
 *         description: VAPI Assistant ID
 *       - in: query
 *         name: text
 *         schema:
 *           type: string
 *         description: Text that was synthesized
 *     responses:
 *       200:
 *         description: Audio file
 *         content:
 *           audio/mpeg:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Audio not found or not ready
 *       500:
 *         description: Internal server error
 */
// Get VAPI voice preview audio
router.get("/preview/vapi/:assistantId", authMiddleware, voicesController.getVapiVoicePreview);

/**
 * @swagger
 * /api/voices/preview/vapi/{provider}/{voiceId}:
 *   get:
 *     summary: Generate VAPI voice preview
 *     description: Generate voice preview using VAPI TTS
 *     tags: [Voices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: provider
 *         required: true
 *         schema:
 *           type: string
 *         description: Voice provider (11labs, openai, azure)
 *       - in: path
 *         name: voiceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Voice ID
 *       - in: query
 *         name: text
 *         schema:
 *           type: string
 *         description: Text to synthesize
 *     responses:
 *       200:
 *         description: Voice preview generated
 *       500:
 *         description: Internal server error
 */
// Generate VAPI voice preview
router.get("/preview/vapi/:provider/:voiceId", authMiddleware, voicesController.generateVapiPreview);

module.exports = router;
