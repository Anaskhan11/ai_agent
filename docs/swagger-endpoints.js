/**
 * @swagger
 * components:
 *   schemas:
 *     Tool:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: tool_123
 *         type:
 *           type: string
 *           enum: [function, dtmf, endCall, transferCall, voicemail]
 *           example: function
 *         name:
 *           type: string
 *           example: Get Weather
 *         description:
 *           type: string
 *           example: Get current weather for a location
 *     
 *     File:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: file_123
 *         name:
 *           type: string
 *           example: document.pdf
 *         mimeType:
 *           type: string
 *           example: application/pdf
 *         size:
 *           type: integer
 *           example: 1024000
 *         url:
 *           type: string
 *           example: https://storage.example.com/file_123
 *     
 *     KnowledgeBase:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: kb_123
 *         name:
 *           type: string
 *           example: Customer Support KB
 *         description:
 *           type: string
 *           example: Knowledge base for customer support
 *         fileIds:
 *           type: array
 *           items:
 *             type: string
 *           example: [file_123, file_456]
 *         provider:
 *           type: string
 *           example: openai
 *         embeddingModel:
 *           type: string
 *           example: text-embedding-ada-002
 *     
 *     Session:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: session_123
 *         assistantId:
 *           type: string
 *           example: asst_123
 *         status:
 *           type: string
 *           enum: [active, completed, failed]
 *           example: active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: 2024-01-01T00:00:00.000Z
 *     
 *     Chat:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: chat_123
 *         assistantId:
 *           type: string
 *           example: asst_123
 *         messages:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [user, assistant]
 *                 example: user
 *               content:
 *                 type: string
 *                 example: Hello, how are you?
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-01-01T00:00:00.000Z
 *     
 *     Squad:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: squad_123
 *         name:
 *           type: string
 *           example: Customer Support Squad
 *         description:
 *           type: string
 *           example: Multi-assistant squad for customer support
 *         members:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               assistantId:
 *                 type: string
 *                 example: asst_123
 *     

 *     Analytics:
 *       type: object
 *       properties:
 *         totalCalls:
 *           type: integer
 *           example: 1250
 *         successfulCalls:
 *           type: integer
 *           example: 1180
 *         failedCalls:
 *           type: integer
 *           example: 70
 *         averageDuration:
 *           type: number
 *           example: 420
 *         totalCost:
 *           type: number
 *           example: 245.50
 *     
 *     Log:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: log_123
 *         timestamp:
 *           type: string
 *           format: date-time
 *           example: 2024-01-01T00:00:00.000Z
 *         level:
 *           type: string
 *           enum: [error, warn, info, debug]
 *           example: info
 *         message:
 *           type: string
 *           example: Call started successfully
 *         callId:
 *           type: string
 *           example: call_123
 *         assistantId:
 *           type: string
 *           example: asst_123
 *         metadata:
 *           type: object
 *           example: { "phoneNumber": "+1234567890", "duration": 0 }
 *     
 *     WebhookEvent:
 *       type: object
 *       properties:
 *         message:
 *           type: object
 *           properties:
 *             type:
 *               type: string
 *               enum: [conversation-update, function-call, hang, speech-update, status-update, transcript, tool-calls, transfer-destination-request, user-interrupted, end-of-call-report]
 *               example: conversation-update
 *             timestamp:
 *               type: string
 *               format: date-time
 *               example: 2024-01-01T00:00:00.000Z
 *             callId:
 *               type: string
 *               example: call_123
 *             data:
 *               type: object
 *               description: Event-specific data
 */

/**
 * @swagger
 * /api/transcribers/available:
 *   get:
 *     summary: Get available transcribers
 *     description: Retrieve all available speech-to-text transcribers from different providers
 *     tags: [Transcribers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: provider
 *         schema:
 *           type: string
 *           enum: [deepgram, assembly-ai, openai, azure, google]
 *         description: Filter transcribers by provider
 *     responses:
 *       200:
 *         description: Available transcribers retrieved successfully
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
 *                         deepgram:
 *                           $ref: '#/components/schemas/Transcriber'
 *                         assembly-ai:
 *                           $ref: '#/components/schemas/Transcriber'
 *                         openai:
 *                           $ref: '#/components/schemas/Transcriber'
 */

/**
 * @swagger
 * /api/phone-numbers:
 *   get:
 *     summary: List all phone numbers
 *     description: Retrieve all phone numbers configured in VAPI
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Phone numbers retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/PhoneNumber'
 *   post:
 *     summary: Create phone number
 *     description: Add a new phone number to VAPI
 *     tags: [Phone Numbers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - twilioAccountSid
 *               - twilioAuthToken
 *               - twilioPhoneNumber
 *             properties:
 *               twilioAccountSid:
 *                 type: string
 *                 example: AC1234567890abcdef1234567890abcdef
 *               twilioAuthToken:
 *                 type: string
 *                 example: your_twilio_auth_token
 *               twilioPhoneNumber:
 *                 type: string
 *                 example: +1234567890
 *               name:
 *                 type: string
 *                 example: Main Support Line
 *               assistantId:
 *                 type: string
 *                 example: asst_123
 *     responses:
 *       201:
 *         description: Phone number created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Success'
 */

/**
 * @swagger
 * /api/tools:
 *   get:
 *     summary: List all tools
 *     description: Retrieve all function tools and integrations
 *     tags: [Tools]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tools retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Tool'
 */

module.exports = {};
