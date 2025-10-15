const axios = require("axios");
const crypto = require("crypto");
const pool = require("../../config/DBConnection");
const FacebookService = require("../../services/FacebookService");
const WebhookTestController = require("../WebhookTestController/WebhookTestController");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Handle server message webhook
const handleServerMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // Verify webhook signature if provided
    const signature = req.headers['x-vapi-signature'];
    if (signature) {
      const isValid = verifyWebhookSignature(req.body, signature);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid webhook signature"
        });
      }
    }

    // Process different message types
    switch (message.type) {
      case "conversation-update":
        await handleConversationUpdate(message);
        break;
      case "function-call":
        await handleFunctionCall(message);
        break;
      case "hang":
        await handleHang(message);
        break;
      case "speech-update":
        await handleSpeechUpdate(message);
        break;
      case "status-update":
        await handleStatusUpdate(message);
        break;
      case "transcript":
        await handleTranscript(message);
        break;
      case "tool-calls":
        await handleToolCalls(message);
        break;
      case "transfer-destination-request":
        await handleTransferDestinationRequest(message);
        break;
      case "user-interrupted":
        await handleUserInterrupted(message);
        break;
      case "end-of-call-report":
        await handleEndOfCallReport(message);
        break;
      default:
        console.log(`Unknown message type: ${message.type}`);
    }

    res.status(200).json({
      success: true,
      message: "Webhook processed successfully"
    });
  } catch (error) {
    console.error("Error processing server message webhook:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process webhook",
      error: error.message
    });
  }
};

// Handle client message webhook
const handleClientMessage = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // Process client-side messages
    switch (message.type) {
      case "conversation-update":
        await handleClientConversationUpdate(message);
        break;
      case "function-call":
        await handleClientFunctionCall(message);
        break;
      case "hang":
        await handleClientHang(message);
        break;
      case "model-output":
        await handleModelOutput(message);
        break;
      case "speech-update":
        await handleClientSpeechUpdate(message);
        break;
      case "status-update":
        await handleClientStatusUpdate(message);
        break;
      case "transfer-update":
        await handleTransferUpdate(message);
        break;
      case "transcript":
        await handleClientTranscript(message);
        break;
      case "tool-calls":
        await handleClientToolCalls(message);
        break;
      case "user-interrupted":
        await handleClientUserInterrupted(message);
        break;
      case "voice-input":
        await handleVoiceInput(message);
        break;
      default:
        console.log(`Unknown client message type: ${message.type}`);
    }

    res.status(200).json({
      success: true,
      message: "Client webhook processed successfully"
    });
  } catch (error) {
    console.error("Error processing client message webhook:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process client webhook",
      error: error.message
    });
  }
};

// Verify webhook signature
const verifyWebhookSignature = (payload, signature) => {
  try {
    const secret = process.env.VAPI_WEBHOOK_SECRET || "your-webhook-secret";
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    console.error("Error verifying webhook signature:", error);
    return false;
  }
};

// Message handlers
const handleConversationUpdate = async (message) => {
  console.log("Conversation update:", message);
  // Store conversation updates in database
};

const handleFunctionCall = async (message) => {
  console.log("Function call:", message);
  // Handle function calls and return responses
};

const handleHang = async (message) => {
  console.log("Call hang:", message);
  // Handle call hang events
};

const handleSpeechUpdate = async (message) => {
  console.log("Speech update:", message);
  // Handle speech updates
};

const handleStatusUpdate = async (message) => {
  console.log("Status update:", message);
  // Handle status updates
};

const handleTranscript = async (message) => {
  console.log("Transcript:", message);
  // Store transcripts in database
};

const handleToolCalls = async (message) => {
  console.log("Tool calls:", message);
  // Handle tool calls
};

const handleTransferDestinationRequest = async (message) => {
  console.log("Transfer destination request:", message);
  // Handle transfer requests
};

const handleUserInterrupted = async (message) => {
  console.log("User interrupted:", message);
  // Handle user interruptions
};

const handleEndOfCallReport = async (message) => {
  console.log("End of call report:", message);
  // Store call reports and analytics
};

// Client message handlers
const handleClientConversationUpdate = async (message) => {
  console.log("Client conversation update:", message);
};

const handleClientFunctionCall = async (message) => {
  console.log("Client function call:", message);
};

const handleClientHang = async (message) => {
  console.log("Client hang:", message);
};

const handleModelOutput = async (message) => {
  console.log("Model output:", message);
};

const handleClientSpeechUpdate = async (message) => {
  console.log("Client speech update:", message);
};

const handleClientStatusUpdate = async (message) => {
  console.log("Client status update:", message);
};

const handleTransferUpdate = async (message) => {
  console.log("Transfer update:", message);
};

const handleClientTranscript = async (message) => {
  console.log("Client transcript:", message);
};

const handleClientToolCalls = async (message) => {
  console.log("Client tool calls:", message);
};

const handleClientUserInterrupted = async (message) => {
  console.log("Client user interrupted:", message);
};

const handleVoiceInput = async (message) => {
  console.log("Voice input:", message);
};

// Resolve assistant id to VAPI UUID if a local numeric id was provided
const resolveAssistantIdToVapiId = async (assistantId) => {
  try {
    if (!assistantId) return null;
    const idStr = String(assistantId).trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idStr)) return idStr;

    const connection = await pool.getConnection();
    try {
      if (/^\d+$/.test(idStr)) {
        const [rows] = await connection.execute(
          'SELECT assistant_id FROM assistants WHERE id = ? LIMIT 1',
          [parseInt(idStr)]
        );
        if (rows.length > 0 && rows[0].assistant_id) return rows[0].assistant_id;
      }
      const [rows2] = await connection.execute(
        'SELECT assistant_id FROM assistants WHERE assistant_id = ? LIMIT 1',
        [idStr]
      );
      if (rows2.length > 0 && rows2[0].assistant_id) return rows2[0].assistant_id;
      return null;
    } finally {
      connection.release();
    }
  } catch (e) {
    console.log('⚠️ Failed to resolve assistant id to VAPI id:', e.message);
    return null;
  }
};

// Get webhook configuration
const getWebhookConfig = async (req, res) => {
  try {
    const webhookConfig = {
      serverUrl: process.env.VAPI_SERVER_URL || "https://your-server.com/api/webhooks/server",
      serverSecret: process.env.VAPI_WEBHOOK_SECRET || "your-webhook-secret",
      supportedEvents: [
        "conversation-update",
        "function-call",
        "hang",
        "speech-update",
        "status-update",
        "transcript",
        "tool-calls",
        "transfer-destination-request",
        "user-interrupted",
        "end-of-call-report"
      ],
      clientEvents: [
        "conversation-update",
        "function-call",
        "hang",
        "model-output",
        "speech-update",
        "status-update",
        "transfer-update",
        "transcript",
        "tool-calls",
        "user-interrupted",
        "voice-input"
      ]
    };

    res.status(200).json({
      success: true,
      message: "Webhook configuration retrieved successfully",
      data: webhookConfig
    });
  } catch (error) {
    console.error("Error fetching webhook configuration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch webhook configuration",
      error: error.message
    });
  }
};

// Test webhook
const testWebhook = async (req, res) => {
  try {
    const { url, secret, eventType } = req.body;

    if (!url || !eventType) {
      return res.status(400).json({
        success: false,
        message: "URL and event type are required"
      });
    }

    // Create test payload
    const testPayload = {
      message: {
        type: eventType,
        timestamp: new Date().toISOString(),
        callId: "test_call_123",
        data: {
          test: true,
          message: "This is a test webhook"
        }
      }
    };

    // Send test webhook
    const response = await axios.post(url, testPayload, {
      headers: {
        "Content-Type": "application/json",
        "X-Vapi-Signature": secret ? crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(testPayload))
          .digest('hex') : undefined
      },
      timeout: 5000
    });

    res.status(200).json({
      success: true,
      message: "Webhook test completed successfully",
      data: {
        url,
        eventType,
        responseStatus: response.status,
        responseTime: Date.now() - Date.now() // This would be calculated properly
      }
    });
  } catch (error) {
    console.error("Error testing webhook:", error);
    res.status(500).json({
      success: false,
      message: "Webhook test failed",
      error: error.message
    });
  }
};

// Create a new webhook workflow (Enterprise-level)
const createWebhook = async (req, res) => {
  try {
    const {
      name,
      trigger_event,
      trigger_app,
      workflow_config,
      is_active = true,
      description,
      url
    } = req.body;
    const userId = req.user?.id;

    console.log('🔧 Creating webhook workflow:', { name, trigger_event, trigger_app, userId, url });

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!name || !trigger_event) {
      return res.status(400).json({
        success: false,
        message: "Name and trigger event are required"
      });
    }

    let webhookId;
    let webhookUrl;

    if (url) {
      // Extract webhook ID from provided URL
      const urlParts = url.split('/');
      webhookId = urlParts[urlParts.length - 1];
      webhookUrl = url;
      console.log('📡 Using provided webhook URL:', webhookUrl, 'with ID:', webhookId);
    } else {
      // Generate unique webhook ID for data capture
      webhookId = crypto.randomBytes(16).toString('hex');

      // Create webhook capture URL
      const baseUrl = process.env.BASE_URL || process.env.BASE_URL || 'http://localhost:5001';
      webhookUrl = `${baseUrl}/api/webhook-data/capture/${webhookId}`;
      console.log('📡 Generated webhook URL:', webhookUrl);
    }

    // Save to database
    const connection = await pool.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO webhooks (
          webhook_id, user_id, name, trigger_type, description,
          workflow_config, url, status, is_active, events, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, NOW(), NOW())`,
        [
          webhookId,
          userId,
          name,
          trigger_event,
          description || '',
          JSON.stringify(workflow_config || {}),
          webhookUrl,
          is_active ? 1 : 0,
          JSON.stringify([trigger_event])
        ]
      );

      const insertId = result.insertId;
      console.log(`✅ Webhook workflow created with ID: ${insertId}`);

      // Return complete webhook data
      const webhookData = {
        id: insertId,
        webhook_id: webhookId,
        user_id: userId,
        name,
        trigger_type: trigger_event,
        workflow_config,
        url: webhookUrl,
        status: 'active',
        is_active: is_active ? 1 : 0,
        description: description || '',
        events: [trigger_event],
        created_at: new Date().toISOString()
      };

      res.status(201).json({
        success: true,
        message: "Webhook workflow created successfully",
        data: webhookData
      });

    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("❌ Error creating webhook workflow:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create webhook workflow",
      error: error.message
    });
  }
};

// Update webhook (general update for auto-save)
const updateWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { name, description, triggerType, url, isActive, actionCards } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const connection = await pool.getConnection();
    try {
      // Merge metadata with existing to avoid overwriting other settings (e.g., configuration.lists)
      let existingMeta = {};
      try {
        const [rowsByWebhookId] = await connection.execute(
          `SELECT metadata FROM webhooks WHERE webhook_id = ? AND user_id = ? LIMIT 1`,
          [webhookId, userId]
        );
        if (rowsByWebhookId && rowsByWebhookId.length > 0) {
          try { existingMeta = JSON.parse(rowsByWebhookId[0].metadata || '{}'); } catch { existingMeta = {}; }
        } else {
          const [rowsById] = await connection.execute(
            `SELECT metadata FROM webhooks WHERE id = ? AND user_id = ? LIMIT 1`,
            [webhookId, userId]
          );
          if (rowsById && rowsById.length > 0) {
            try { existingMeta = JSON.parse(rowsById[0].metadata || '{}'); } catch { existingMeta = {}; }
          }
        }
      } catch (e) {
        existingMeta = {};
      }

      // Start from existing metadata and update only fields we manage here
      const metadata = { ...existingMeta };
      if (Array.isArray(actionCards)) {
        metadata.actionCards = actionCards;
      } else {
        // Keep existing actionCards if not provided
        metadata.actionCards = Array.isArray(existingMeta.actionCards) ? existingMeta.actionCards : [];
      }
      metadata.lastUpdated = new Date().toISOString();

      // Update webhook with both status and is_active fields
      try {
        const [updateByWebhookId] = await connection.execute(
          `UPDATE webhooks SET
           name = COALESCE(?, name),
           url = COALESCE(?, url),
           events = COALESCE(?, events),
           status = COALESCE(?, status),
           is_active = COALESCE(?, is_active),
           metadata = ?,
           updated_at = NOW()
           WHERE webhook_id = ? AND user_id = ?`,
          [
            name,
            url,
            triggerType ? JSON.stringify([triggerType]) : null,
            isActive !== undefined ? (isActive ? 'active' : 'inactive') : null,
            isActive !== undefined ? (isActive ? 1 : 0) : null,
            JSON.stringify(metadata),
            webhookId,
            userId
          ]
        );

        // If no rows updated (param might be numeric id), try updating by id as well
        if (!updateByWebhookId || updateByWebhookId.affectedRows === 0) {
          await connection.execute(
            `UPDATE webhooks SET
             name = COALESCE(?, name),
             url = COALESCE(?, url),
             events = COALESCE(?, events),
             status = COALESCE(?, status),
             is_active = COALESCE(?, is_active),
             metadata = ?,
             updated_at = NOW()
             WHERE id = ? AND user_id = ?`,
            [
              name,
              url,
              triggerType ? JSON.stringify([triggerType]) : null,
              isActive !== undefined ? (isActive ? 'active' : 'inactive') : null,
              isActive !== undefined ? (isActive ? 1 : 0) : null,
              JSON.stringify(metadata),
              webhookId,
              userId
            ]
          );
        }
      } catch (error) {
        // If that fails, try the migration schema (with id as primary key)
        if (error.code === 'ER_BAD_FIELD_ERROR') {
          await connection.execute(
            `UPDATE webhooks SET
             name = COALESCE(?, name),
             description = COALESCE(?, description),
             trigger_type = COALESCE(?, trigger_type),
             url = COALESCE(?, url),
             is_active = COALESCE(?, is_active),
             updated_at = NOW()
             WHERE id = ? AND user_id = ?`,
            [
              name,
              description,
              triggerType,
              url,
              isActive !== undefined ? (isActive ? 1 : 0) : null,
              webhookId,
              userId
            ]
          );

          // Best-effort: also try to persist metadata if the column exists in this schema
          try {
            await connection.execute(
              `UPDATE webhooks SET metadata = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
              [JSON.stringify(metadata), webhookId, userId]
            );
          } catch (e) {
            // Ignore if metadata column does not exist in this schema
          }

        } else {
          throw error;
        }
      }

      // Extra safety: attempt to persist metadata regardless of schema path taken
      // Try with webhook_id first
      try {
        await connection.execute(
          `UPDATE webhooks SET metadata = ?, updated_at = NOW() WHERE webhook_id = ? AND user_id = ?`,
          [JSON.stringify(metadata), webhookId, userId]
        );
      } catch (e1) {
        // Fallback: try with id if webhook_id path failed or doesn't exist
        try {
          await connection.execute(
            `UPDATE webhooks SET metadata = ?, updated_at = NOW() WHERE id = ? AND user_id = ?`,
            [JSON.stringify(metadata), webhookId, userId]
          );
        } catch (e2) {
          // If both fail, continue without throwing to not block the request
        }
      }

      // If the frontend provided a capture URL, also persist metadata against that webhook_id explicitly
      if (typeof url === 'string') {
        const match = url.match(/\/capture\/([^/]+)/);
        if (match && match[1]) {
          const capturedWebhookId = match[1];
          try {
            await connection.execute(
              `UPDATE webhooks SET metadata = ?, updated_at = NOW() WHERE webhook_id = ? AND user_id = ?`,
              [JSON.stringify(metadata), capturedWebhookId, userId]
            );
          } catch (e3) {
            // ignore if not present
          }
        }
      }

      res.status(200).json({
        success: true,
        message: "Webhook updated successfully"
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error updating webhook:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update webhook",
      error: error.message
    });
  }
};

// Update webhook configuration
const updateWebhookConfig = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { listId, appType } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const connection = await pool.getConnection();
    try {
      // Get current webhook
      const [webhookRows] = await connection.execute(
        `SELECT metadata FROM webhooks WHERE webhook_id = ? AND user_id = ?`,
        [webhookId, userId]
      );

      if (webhookRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Webhook not found"
        });
      }

      // Parse existing metadata
      let metadata = {};
      try {
        metadata = JSON.parse(webhookRows[0].metadata || '{}');
      } catch (e) {
        metadata = {};
      }

      // Update metadata with new configuration while preserving existing actionCards
      metadata.configuration = {
        ...metadata.configuration,
        [appType]: {
          listId: listId
        }
      };

      // Ensure actionCards are preserved if they exist
      if (!metadata.actionCards && metadata.actionCards !== null) {
        // Keep any existing actionCards that might have been set previously
        console.log('ℹ️ Preserving existing actionCards in metadata during config update');
      }

      // Update webhook in database
      await connection.execute(
        `UPDATE webhooks SET metadata = ?, updated_at = NOW() WHERE webhook_id = ? AND user_id = ?`,
        [JSON.stringify(metadata), webhookId, userId]
      );

      res.status(200).json({
        success: true,
        message: "Webhook configuration updated successfully"
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error updating webhook configuration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update webhook configuration",
      error: error.message
    });
  }
};

// List user webhooks
const listWebhooks = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    // Fetch from database
    const connection = await pool.getConnection();
    try {
      // Check table structure to determine which fields are available
      const [tableInfo] = await connection.execute(`SHOW COLUMNS FROM webhooks`);
      const hasWebhookIdField = tableInfo.some(col => col.Field === 'webhook_id');

      const [rows] = await connection.execute(
        `SELECT * FROM webhooks WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
      );

      // Normalize the webhook data to ensure consistent identifier field
      const webhooks = rows.map(webhook => {
        // Ensure we have a consistent identifier field for the frontend
        if (hasWebhookIdField && webhook.webhook_id) {
          webhook.webhook_id = webhook.webhook_id;
        } else if (webhook.id) {
          webhook.webhook_id = webhook.id; // Use id as webhook_id for consistency
        }
        return webhook;
      });

      console.log(`Found ${webhooks.length} webhooks for user ${userId}`);
      if (webhooks.length > 0) {
        console.log('Sample webhook structure:', {
          id: webhooks[0].id,
          webhook_id: webhooks[0].webhook_id,
          name: webhooks[0].name,
          hasWebhookIdField
        });
      }

      return res.status(200).json({
        success: true,
        data: webhooks
      });
    } finally {
      connection.release();
    }


  } catch (error) {
    console.error("Error listing webhooks:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list webhooks",
      error: error.message
    });
  }
};

// Delete webhook endpoint
const deleteWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const userId = req.user?.id;

    console.log(`Delete webhook request - webhookId: ${webhookId}, userId: ${userId}`);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!webhookId) {
      return res.status(400).json({
        success: false,
        message: "Webhook ID is required"
      });
    }

    const connection = await pool.getConnection();
    try {
      // Try multiple approaches to find and delete the webhook
      let webhookRows = [];
      let deleteQuery = '';
      let deleteParams = [];

      // Approach 1: Try webhook_id field (enhanced schema)
      try {
        [webhookRows] = await connection.execute(
          `SELECT * FROM webhooks WHERE webhook_id = ? AND user_id = ?`,
          [webhookId, userId]
        );
        if (webhookRows.length > 0) {
          deleteQuery = `DELETE FROM webhooks WHERE webhook_id = ? AND user_id = ?`;
          deleteParams = [webhookId, userId];
          console.log('Found webhook using webhook_id field');
        }
      } catch (error) {
        console.log('webhook_id field not available or query failed');
      }

      // Approach 2: Try id field if not found above
      if (webhookRows.length === 0) {
        try {
          [webhookRows] = await connection.execute(
            `SELECT * FROM webhooks WHERE id = ? AND user_id = ?`,
            [webhookId, userId]
          );
          if (webhookRows.length > 0) {
            deleteQuery = `DELETE FROM webhooks WHERE id = ? AND user_id = ?`;
            deleteParams = [webhookId, userId];
            console.log('Found webhook using id field');
          }
        } catch (error) {
          console.log('id field query failed:', error.message);
        }
      }

      // Approach 3: Try without user_id constraint (as last resort)
      if (webhookRows.length === 0) {
        try {
          [webhookRows] = await connection.execute(
            `SELECT * FROM webhooks WHERE id = ? OR webhook_id = ?`,
            [webhookId, webhookId]
          );
          if (webhookRows.length > 0) {
            // Check if the webhook belongs to the user
            const webhook = webhookRows[0];
            if (webhook.user_id === userId) {
              deleteQuery = `DELETE FROM webhooks WHERE id = ?`;
              deleteParams = [webhook.id];
              console.log('Found webhook using fallback approach');
            } else {
              console.log('Webhook found but belongs to different user');
              webhookRows = []; // Reset to trigger not found error
            }
          }
        } catch (error) {
          console.log('Fallback query failed:', error.message);
        }
      }

      if (webhookRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Webhook not found or you don't have permission to delete it"
        });
      }

      // Delete the webhook
      await connection.execute(deleteQuery, deleteParams);
      console.log(`Successfully deleted webhook: ${webhookId}`);

      // Also delete related webhook logs (try both possible webhook_id values)
      try {
        await connection.execute(
          `DELETE FROM webhook_logs WHERE webhook_id = ?`,
          [webhookId]
        );
      } catch (error) {
        console.log('Error deleting webhook logs (this is non-critical):', error.message);
      }

      res.status(200).json({
        success: true,
        message: "Webhook deleted successfully"
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error("Error deleting webhook:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete webhook",
      error: error.message
    });
  }
};

// Handle general webhook requests
const handleGeneralWebhook = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const method = req.method;
    const headers = req.headers;
    const body = req.body;
    const query = req.query;

    // Log the webhook request
    console.log(`Webhook ${webhookId} triggered:`, {
      method,
      headers: Object.keys(headers),
      bodySize: JSON.stringify(body).length,
      query
    });

    const connection = await pool.getConnection();
    try {
      // Fetch webhook from database and verify it exists and is active
      let webhookRows;
      try {
        // Check using webhook_id and verify it's active (both status and is_active fields exist)
        [webhookRows] = await connection.execute(
          `SELECT * FROM webhooks WHERE webhook_id = ? AND status = 'active' AND is_active = 1`,
          [webhookId]
        );
      } catch (error) {
        // If webhook_id field doesn't exist, try with id field
        if (error.code === 'ER_BAD_FIELD_ERROR') {
          [webhookRows] = await connection.execute(
            `SELECT * FROM webhooks WHERE id = ? AND is_active = 1`,
            [webhookId]
          );
        } else {
          throw error;
        }
      }

      if (webhookRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Webhook not found or inactive"
        });
      }

      const webhook = webhookRows[0];

      // Update trigger count and last triggered time (try both schema formats)
      try {
        // Try enhanced schema first
        await connection.execute(
          `UPDATE webhooks SET success_count = success_count + 1, last_triggered = NOW() WHERE webhook_id = ?`,
          [webhookId]
        );
      } catch (error) {
        // If that fails, try migration schema
        if (error.code === 'ER_BAD_FIELD_ERROR') {
          await connection.execute(
            `UPDATE webhooks SET trigger_count = trigger_count + 1, last_triggered = NOW() WHERE id = ?`,
            [webhookId]
          );
        } else {
          throw error;
        }
      }

      // Process the webhook based on trigger type
      const webhookData = {
        webhookId,
        method,
        headers,
        body,
        query,
        timestamp: new Date().toISOString(),
        ip: req.ip || req.connection.remoteAddress
      };

      // Store webhook data for user to view
      await connection.execute(
        `INSERT INTO webhook_logs (webhook_id, method, headers, body, query_params, ip_address, user_agent, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          webhookId,
          method,
          JSON.stringify(headers),
          JSON.stringify(body),
          JSON.stringify(query),
          req.ip || req.connection.remoteAddress,
          headers['user-agent'] || null
        ]
      );

      // Process webhook data if it's configured for contact storage
      console.log('🚀 About to process webhook for contact storage...');
      console.log('🔍 Webhook object:', JSON.stringify(webhook, null, 2));

      try {
        await processWebhookForContactStorage(webhook, body);
        console.log('✅ Finished processing webhook for contact storage');
      } catch (processingError) {
        console.error('❌ Error in processWebhookForContactStorage:', processingError);

        // Log the error to database for debugging
        await connection.execute(
          `INSERT INTO webhook_logs (webhook_id, method, headers, body, query_params, ip_address, user_agent, timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            webhookId + '_error',
            'ERROR',
            JSON.stringify({'error': 'processing_error'}),
            JSON.stringify({error: processingError.message, stack: processingError.stack}),
            JSON.stringify({}),
            'error',
            'error'
          ]
        );
      }
    } finally {
      connection.release();
    }

    // Send success response
    res.status(200).json({
      success: true,
      message: "Webhook received successfully",
      webhookId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error handling general webhook:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process webhook",
      error: error.message
    });
  }
};

// Process webhook data for contact storage
const processWebhookForContactStorage = async (webhook, body) => {
  try {
    console.log('🔄 Processing webhook for contact storage...');
    console.log('Webhook ID:', webhook.webhook_id || webhook.id);
    console.log('User ID:', webhook.user_id);

    // Check if webhook has metadata with action cards configured
    if (!webhook.metadata) {
      console.log('❌ No metadata found in webhook');
      return;
    }

    let metadata;
    try {
      metadata = typeof webhook.metadata === 'string' ? JSON.parse(webhook.metadata) : webhook.metadata;
    } catch (error) {
      console.log('❌ Error parsing webhook metadata:', error);
      return;
    }

    const actionCards = metadata.actionCards || [];
    console.log('📋 Total action cards found:', actionCards.length);

    // Debug each action card
    actionCards.forEach((card, index) => {
      console.log(`Card ${index + 1}:`, {
        id: card.id,
        selectedApp: card.selectedApp,
        isConnected: card.isConnected,
        selectedList: card.selectedList,
        selectedListId: card.selectedListId
      });
    });

    // Find Lists action card to get the connected list ID
    const listsAction = actionCards.find(card =>
      card.selectedApp?.name === 'Lists'
    );

    console.log('🔍 Lists action found:', !!listsAction);
    if (listsAction) {
      console.log('📋 Lists action details:', {
        selectedApp: listsAction.selectedApp,
        selectedList: listsAction.selectedList,
        selectedListId: listsAction.selectedListId,
        isConnected: listsAction.isConnected
      });
    }

    if (!listsAction) {
      console.log('❌ No Lists action found in webhook configuration');
      return;
    }

    // Get the configured list ID from the Lists action
    const listId = listsAction.selectedList || listsAction.selectedListId;

    if (!listId) {
      console.log('❌ No list configured in webhook action');
      return;
    }

    // Store ALL webhook data dynamically in the configured list
    await addDynamicContactToList(webhook.user_id, listId, body);

    const email = body.email || body.emailAddress || 'unknown';
    console.log(`✅ Contact ${email} added to list ${listId}`);

    // After storing contact, check for Outbound Campaign action
    await maybeTriggerOutboundCampaign(webhook, body, metadata);

  } catch (error) {
    console.error('❌ Error processing webhook for contact storage:', error);
  }
};

// Extract contact information from webhook body
const extractContactInfoFromWebhookBody = (body) => {
  const contactInfo = {
    email: '',
    fullName: '',
    phoneNumber: '',
    firstName: '',
    lastName: '',
    company: ''
  };

  if (!body || typeof body !== 'object') {
    return contactInfo;
  }

  // Direct field mapping
  if (body.email) contactInfo.email = body.email;
  if (body.fullName) contactInfo.fullName = body.fullName;
  if (body.phoneNumber) contactInfo.phoneNumber = body.phoneNumber;
  if (body.firstName) contactInfo.firstName = body.firstName;
  if (body.lastName) contactInfo.lastName = body.lastName;
  if (body.company) contactInfo.company = body.company;

  // Alternative field names
  if (!contactInfo.email && body.emailAddress) contactInfo.email = body.emailAddress;
  if (!contactInfo.fullName && body.name) contactInfo.fullName = body.name;
  if (!contactInfo.phoneNumber && body.phone) contactInfo.phoneNumber = body.phone;
  if (!contactInfo.phoneNumber && body.mobile) contactInfo.phoneNumber = body.mobile;

  // Construct full name from first and last name if not provided
  if (!contactInfo.fullName && (contactInfo.firstName || contactInfo.lastName)) {
    contactInfo.fullName = `${contactInfo.firstName || ''} ${contactInfo.lastName || ''}`.trim();
  }

  // Use email as fallback for fullName if nothing else is available
  if (!contactInfo.fullName && contactInfo.email) {
    contactInfo.fullName = contactInfo.email.split('@')[0];
  }

  return contactInfo;
};

// Add dynamic contact to list - stores ALL webhook data fields
const addDynamicContactToList = async (userId, listId, webhookData) => {
  const connection = await pool.getConnection();
  try {
    console.log('💾 Adding dynamic contact to list:', listId);
    console.log('📊 Webhook data received:', JSON.stringify(webhookData, null, 2));

    // Extract email for primary identification (if exists)
    const email = webhookData.email || webhookData.emailAddress || webhookData.Email || '';

    // Create a dynamic contact object with ALL webhook fields
    const dynamicContact = {
      email: email,
      fullName: webhookData.fullName || webhookData.name || webhookData.Name || email.split('@')[0] || 'Unknown',
      phoneNumber: webhookData.phoneNumber || webhookData.phone || webhookData.Phone || webhookData.mobile || '',
      firstName: webhookData.firstName || webhookData.first_name || '',
      lastName: webhookData.lastName || webhookData.last_name || '',
      company: webhookData.company || webhookData.Company || '',
      // Store ALL additional fields as JSON in a custom_fields column
      customFields: JSON.stringify(webhookData)
    };

    console.log('📝 Dynamic contact object:', JSON.stringify(dynamicContact, null, 2));

    // Insert the contact with existing table structure
    // Store only the clean full name, not the JSON data
    const cleanFullName = dynamicContact.fullName || '';

    const [result] = await connection.execute(
      `INSERT INTO contacts (email, fullName, phoneNumber, listId, createdAt)
       VALUES (?, ?, ?, ?, NOW())`,
      [
        dynamicContact.email,
        cleanFullName.substring(0, 250), // Limit to field size
        dynamicContact.phoneNumber,
        listId
      ]
    );

    console.log('✅ Dynamic contact added with ID:', result.insertId);

    // Update list contact count
    await connection.execute(
      'UPDATE lists SET contacts_count = contacts_count + 1 WHERE id = ?',
      [listId]
    );

    console.log('📊 List contact count updated');

  } catch (error) {
    console.error('❌ Error adding dynamic contact:', error);
    throw error;
  } finally {
    connection.release();
  }
};

// Normalize phone number to E.164 format with optional default country code
const normalizePhoneToE164 = (rawNumber) => {
  if (!rawNumber || typeof rawNumber !== 'string') return '';
  let number = rawNumber.trim();
  // Already E.164
  if (/^\+[1-9]\d{6,14}$/.test(number)) return number;
  // Remove non-digits
  const digits = number.replace(/\D/g, '');
  if (!digits) return '';
  // If it already looks like an international number without +
  if (/^[1-9]\d{6,14}$/.test(digits)) return `+${digits}`;
  // Fallback: prepend default country code (env or +1)
  const defaultCc = (process.env.DEFAULT_CALLING_COUNTRY_CODE || '+1').replace(/\D/g, '1');
  return `+${defaultCc}${digits}`;
};

// Create a VAPI campaign if an outbound-campaign action is configured
const maybeTriggerOutboundCampaign = async (webhook, body, metadata) => {
  try {
    const actionCards = metadata?.actionCards || [];
    if (!Array.isArray(actionCards) || actionCards.length === 0) {
      console.log('❌ No action cards configured; skipping outbound campaign');
      return;
    }

    // Find outbound campaign action card
    const campaignCard = actionCards.find(card => card?.selectedApp?.id === 'outbound-campaign');
    if (!campaignCard) {
      console.log('ℹ️ No outbound-campaign action found; skipping');
      return;
    }

    const config = campaignCard.campaignConfig || {};
    const phoneNumberId = config.phoneNumberId;
    const assistantId = config.assistantId;
    const workflowId = config.workflowId;
    const autoLaunch = Boolean(config.autoLaunch);
    const campaignName = config.name || `Webhook Campaign - ${new Date().toISOString().slice(0, 10)}`;

    if (!phoneNumberId) {
      console.log('❌ Outbound campaign config missing phoneNumberId; skipping');
      return;
    }
    if (!assistantId && !workflowId) {
      console.log('❌ Outbound campaign config requires assistantId or workflowId; skipping');
      return;
    }

    // Extract contact info
    const contact = extractContactInfoFromWebhookBody(body);
    const normalizedNumber = normalizePhoneToE164(contact.phoneNumber);

    if (!normalizedNumber) {
      console.log('❌ No valid phone number found in webhook payload; skipping campaign');
      return;
    }

    const customers = [
      {
        name: contact.fullName || contact.email || 'Lead',
        number: normalizedNumber,
        email: contact.email || undefined
      }
    ];

    const campaignData = {
      name: campaignName,
      phoneNumberId,
      customers,
      ...(await resolveAssistantIdToVapiId(assistantId) ? { assistantId: await resolveAssistantIdToVapiId(assistantId) } : {}),
      ...(workflowId ? { workflowId } : {})
    };

    console.log('🚀 Creating VAPI campaign from webhook action:', campaignData);

    const response = await axios.post(`${VAPI_BASE_URL}/campaign`, campaignData, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const created = response.data;
    console.log('✅ VAPI campaign created from webhook:', created.id, created.status);

    if (autoLaunch) {
      try {
        // Give VAPI a moment then ensure in-progress
        await new Promise(r => setTimeout(r, 800));
        const statusResp = await axios.get(`${VAPI_BASE_URL}/campaign/${created.id}`, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        if (statusResp.data?.status === 'scheduled') {
          const launchResp = await axios.patch(`${VAPI_BASE_URL}/campaign/${created.id}`, { status: 'in-progress' }, {
            headers: {
              Authorization: `Bearer ${VAPI_SECRET_KEY}`,
              'Content-Type': 'application/json'
            }
          });
          console.log('📞 Campaign auto-launched:', launchResp.data?.status);
        }
      } catch (launchErr) {
        console.log('⚠️ Auto-launch attempt failed (non-fatal):', launchErr.response?.data || launchErr.message);
      }
    }

  } catch (error) {
    console.error('❌ Error creating outbound campaign from webhook:', error.response?.data || error.message);
  }
};

// Facebook webhook verification (GET request)
const verifyFacebookWebhook = async (req, res) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Facebook webhook verification:', { mode, token, challenge });

    // Verify the token matches what we expect
    if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
      console.log('Facebook webhook verified successfully');
      res.status(200).send(challenge);
    } else {
      console.log('Facebook webhook verification failed');
      res.status(403).send('Forbidden');
    }
  } catch (error) {
    console.error('Error verifying Facebook webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Facebook webhook handler (POST request)
const handleFacebookWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);

    console.log('Facebook webhook received:', {
      signature: signature ? 'present' : 'missing',
      payloadLength: payload.length,
      body: req.body
    });

    // Verify webhook signature
    if (signature && process.env.FACEBOOK_APP_SECRET) {
      const isValid = FacebookService.validateWebhookSignature(
        payload,
        signature,
        process.env.FACEBOOK_APP_SECRET
      );

      if (!isValid) {
        console.log('Invalid Facebook webhook signature');
        return res.status(401).send('Unauthorized');
      }
    }

    // Process webhook data
    if (req.body.object === 'page') {
      for (const entry of req.body.entry || []) {
        await processFacebookPageEntry(entry);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Error handling Facebook webhook:', error);
    res.status(500).send('Internal Server Error');
  }
};

// Process Facebook page entry
const processFacebookPageEntry = async (entry) => {
  try {
    const pageId = entry.id;
    const changes = entry.changes || [];

    console.log(`Processing Facebook page entry for page ${pageId}:`, changes);

    for (const change of changes) {
      if (change.field === 'leadgen') {
        await processFacebookLead(pageId, change.value);
      }
    }
  } catch (error) {
    console.error('Error processing Facebook page entry:', error);
  }
};

// Process Facebook lead
const processFacebookLead = async (pageId, leadData) => {
  try {
    const leadId = leadData.leadgen_id;
    const formId = leadData.form_id;
    const createdTime = leadData.created_time;

    console.log(`Processing Facebook lead: ${leadId} from form ${formId}`);

    // Find the user who owns this page
    const connection = await pool.getConnection();
    let userId, pageAccessToken;

    try {
      const [pageRows] = await connection.execute(
        `SELECT user_id, page_access_token FROM facebook_pages WHERE page_id = ?`,
        [pageId]
      );

      if (pageRows.length === 0) {
        console.log(`No user found for Facebook page ${pageId}`);
        return;
      }

      userId = pageRows[0].user_id;
      pageAccessToken = pageRows[0].page_access_token;
    } finally {
      connection.release();
    }

    // Fetch lead details from Facebook
    const leadDetails = await fetchFacebookLeadDetails(leadId, pageAccessToken);

    if (!leadDetails) {
      console.log(`Could not fetch details for lead ${leadId}`);
      return;
    }

    // Store lead in database and process it
    await storeFacebookLead(userId, leadId, formId, pageId, leadDetails);

    // Create list and contact, then campaign
    await processLeadForCampaign(userId, leadId, formId, leadDetails);

  } catch (error) {
    console.error('Error processing Facebook lead:', error);
  }
};

// Fetch lead details from Facebook
const fetchFacebookLeadDetails = async (leadId, pageAccessToken) => {
  try {
    // Check if this is a test lead first
    if (leadId.startsWith('test_lead_')) {
      const testData = await WebhookTestController.getTestLeadData(leadId);
      if (testData) {
        console.log('Using test lead data for:', leadId);
        return testData;
      }
    }

    // Fetch real lead data from Facebook
    const response = await axios.get(`https://graph.facebook.com/v18.0/${leadId}`, {
      params: {
        access_token: pageAccessToken,
        fields: 'id,created_time,field_data'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Error fetching Facebook lead details:', error);

    // If it's a test lead and Facebook API fails, try test data
    if (leadId.startsWith('test_lead_')) {
      const testData = await WebhookTestController.getTestLeadData(leadId);
      if (testData) {
        console.log('Fallback to test lead data for:', leadId);
        return testData;
      }
    }

    return null;
  }
};

// Store Facebook lead in database
const storeFacebookLead = async (userId, leadId, formId, pageId, leadDetails) => {
  try {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO facebook_leads (user_id, lead_id, form_id, page_id, lead_data, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE
         lead_data = VALUES(lead_data),
         updated_at = NOW()`,
        [userId, leadId, formId, pageId, JSON.stringify(leadDetails)]
      );

      console.log(`Stored Facebook lead ${leadId} in database`);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error storing Facebook lead:', error);
  }
};

// Process lead for campaign creation
const processLeadForCampaign = async (userId, leadId, formId, leadDetails) => {
  try {
    console.log(`Processing lead ${leadId} for campaign creation`);

    // Extract contact information from lead data
    const fieldData = leadDetails.field_data || [];
    const contactInfo = {};

    fieldData.forEach(field => {
      const name = field.name.toLowerCase();
      const value = field.values && field.values[0];

      if (name.includes('email')) {
        contactInfo.email = value;
      } else if (name.includes('phone') || name.includes('mobile')) {
        contactInfo.phoneNumber = value;
      } else if (name.includes('name') || name.includes('full_name')) {
        contactInfo.fullName = value;
      } else if (name.includes('first_name')) {
        contactInfo.firstName = value;
      } else if (name.includes('last_name')) {
        contactInfo.lastName = value;
      } else if (name.includes('company')) {
        contactInfo.company = value;
      }
    });

    // Ensure we have required fields
    if (!contactInfo.email) {
      console.log(`Lead ${leadId} missing email, skipping campaign creation`);
      return;
    }

    // Create full name if not present
    if (!contactInfo.fullName && (contactInfo.firstName || contactInfo.lastName)) {
      contactInfo.fullName = `${contactInfo.firstName || ''} ${contactInfo.lastName || ''}`.trim();
    }

    // Get form name for list creation
    const connection = await pool.getConnection();
    let formName = 'Facebook Lead Form';

    try {
      const [formRows] = await connection.execute(
        `SELECT form_name FROM facebook_lead_forms WHERE form_id = ? AND user_id = ?`,
        [formId, userId]
      );

      if (formRows.length > 0) {
        formName = formRows[0].form_name;
      }
    } finally {
      connection.release();
    }

    // Check if there's a webhook configuration for this user that specifies a list
    let listId = await getConfiguredListForUser(userId, formId);

    if (!listId) {
      // Fallback to automatic list creation if no configuration found
      const listName = `${formName} - Leads`;
      listId = await createOrGetList(userId, listName, `Automatically created from Facebook Lead Form: ${formName}`);
    }

    // Add contact to list
    await addContactToList(userId, listId, contactInfo);

    // Update lead record with list ID
    const connection2 = await pool.getConnection();
    try {
      await connection2.execute(
        `UPDATE facebook_leads SET list_id = ?, processed_at = NOW() WHERE lead_id = ?`,
        [listId, leadId]
      );
    } finally {
      connection2.release();
    }

    // Create campaign for the list (if not already created)
    await createCampaignForList(userId, listId, listName, leadId);

    console.log(`Successfully processed lead ${leadId} - added to list ${listId}`);

  } catch (error) {
    console.error('Error processing lead for campaign:', error);
  }
};

// Get configured list for user from webhook configuration
const getConfiguredListForUser = async (userId, formId) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Look for webhook configurations that have a lists configuration
      const [webhookRows] = await connection.execute(
        `SELECT metadata FROM webhooks WHERE user_id = ? AND status = 'active'`,
        [userId]
      );

      for (const webhook of webhookRows) {
        try {
          const metadata = JSON.parse(webhook.metadata || '{}');
          if (metadata.configuration && metadata.configuration.lists && metadata.configuration.lists.listId) {
            // Verify the list still exists
            const [listRows] = await connection.execute(
              `SELECT id FROM lists WHERE id = ? AND user_id = ?`,
              [metadata.configuration.lists.listId, userId]
            );

            if (listRows.length > 0) {
              console.log(`Using configured list ${metadata.configuration.lists.listId} for user ${userId}`);
              return metadata.configuration.lists.listId;
            }
          }
        } catch (e) {
          // Skip invalid metadata
          continue;
        }
      }

      return null; // No configured list found
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting configured list for user:', error);
    return null;
  }
};

// Create or get existing list
const createOrGetList = async (userId, listName, description) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Check if list already exists
      const [existingRows] = await connection.execute(
        `SELECT id FROM lists WHERE user_id = ? AND list_name = ?`,
        [userId, listName]
      );

      if (existingRows.length > 0) {
        return existingRows[0].id;
      }

      // Create new list
      const [result] = await connection.execute(
        `INSERT INTO lists (user_id, list_name, list_description, type, contacts_count)
         VALUES (?, ?, ?, 'Marketing', 0)`,
        [userId, listName, description]
      );

      console.log(`Created new list: ${listName} with ID: ${result.insertId}`);
      return result.insertId;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating/getting list:', error);
    throw error;
  }
};

// Add contact to list
const addContactToList = async (userId, listId, contactInfo) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Check if contact already exists in this list
      const [existingRows] = await connection.execute(
        `SELECT id FROM contacts WHERE email = ? AND listId = ?`,
        [contactInfo.email, listId]
      );

      if (existingRows.length > 0) {
        console.log(`Contact ${contactInfo.email} already exists in list ${listId}`);
        return existingRows[0].id;
      }

      // Add new contact
      const [result] = await connection.execute(
        `INSERT INTO contacts (fullName, email, phoneNumber, listId, createdAt)
         VALUES (?, ?, ?, ?, NOW())`,
        [
          contactInfo.fullName || contactInfo.email,
          contactInfo.email,
          contactInfo.phoneNumber || '',
          listId
        ]
      );

      // Update list contact count
      await connection.execute(
        `UPDATE lists SET contacts_count = contacts_count + 1 WHERE id = ?`,
        [listId]
      );

      console.log(`Added contact ${contactInfo.email} to list ${listId}`);
      return result.insertId;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error adding contact to list:', error);
    throw error;
  }
};

// Create campaign for list
const createCampaignForList = async (userId, listId, listName, leadId) => {
  try {
    // Check if campaign already created for this lead
    const connection = await pool.getConnection();
    let campaignAlreadyExists = false;

    try {
      const [leadRows] = await connection.execute(
        `SELECT campaign_created, campaign_id FROM facebook_leads WHERE lead_id = ?`,
        [leadId]
      );

      if (leadRows.length > 0 && leadRows[0].campaign_created) {
        console.log(`Campaign already created for lead ${leadId}: ${leadRows[0].campaign_id}`);
        return;
      }
    } finally {
      connection.release();
    }

    // Get contacts from the list for campaign
    const connection2 = await pool.getConnection();
    let contacts = [];

    try {
      const [contactRows] = await connection2.execute(
        `SELECT fullName, email, phoneNumber FROM contacts WHERE listId = ?`,
        [listId]
      );

      contacts = contactRows.map(contact => ({
        name: contact.fullName,
        email: contact.email,
        number: contact.phoneNumber && contact.phoneNumber.startsWith('+')
          ? contact.phoneNumber
          : `+1${contact.phoneNumber.replace(/\D/g, '')}` // Default to US format
      })).filter(contact => contact.number && contact.number.length >= 10);

    } finally {
      connection2.release();
    }

    if (contacts.length === 0) {
      console.log(`No valid contacts found for campaign creation in list ${listId}`);
      return;
    }

    // Get default phone number and assistant (you may want to make this configurable)
    const defaultPhoneNumberId = process.env.DEFAULT_VAPI_PHONE_NUMBER_ID;
    const defaultAssistantId = process.env.DEFAULT_VAPI_ASSISTANT_ID;

    if (!defaultPhoneNumberId || !defaultAssistantId) {
      console.log('Default phone number or assistant not configured, skipping campaign creation');
      return;
    }

    // Create campaign via VAPI
    const campaignData = {
      name: `Auto Campaign - ${listName}`,
      phoneNumberId: defaultPhoneNumberId,
      customers: contacts,
      assistantId: defaultAssistantId
    };

    console.log(`Creating campaign for list ${listId}:`, campaignData);

    const response = await axios.post('https://api.vapi.ai/campaign', campaignData, {
      headers: {
        'Authorization': `Bearer ${process.env.VAPI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const campaign = response.data;
    console.log(`Campaign created successfully:`, campaign.id);

    // Update lead record with campaign info
    const connection3 = await pool.getConnection();
    try {
      await connection3.execute(
        `UPDATE facebook_leads SET campaign_created = TRUE, campaign_id = ? WHERE lead_id = ?`,
        [campaign.id, leadId]
      );
    } finally {
      connection3.release();
    }

    console.log(`Successfully created campaign ${campaign.id} for lead ${leadId}`);

  } catch (error) {
    console.error('Error creating campaign for list:', error);
  }
};

// Get webhook logs for capture functionality
const getWebhookLogs = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { limit = 10 } = req.query;

    if (!webhookId) {
      return res.status(400).json({
        success: false,
        message: "Webhook ID is required"
      });
    }

    const connection = await pool.getConnection();
    try {
      // Get recent webhook logs
      const limitValue = parseInt(limit) || 10;
      const [logs] = await connection.execute(
        `SELECT webhook_id, method, body, timestamp
         FROM webhook_logs
         WHERE webhook_id = ?
         ORDER BY timestamp DESC
         LIMIT ${limitValue}`,
        [webhookId]
      );

      // Parse the body JSON for each log
      const parsedLogs = logs.map(log => ({
        ...log,
        body: typeof log.body === 'string' ? JSON.parse(log.body) : log.body
      }));

      res.status(200).json({
        success: true,
        logs: parsedLogs
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error fetching webhook logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch webhook logs",
      error: error.message
    });
  }
};

module.exports = {
  handleServerMessage,
  handleClientMessage,
  getWebhookConfig,
  testWebhook,
  createWebhook,
  updateWebhook,
  updateWebhookConfig,
  listWebhooks,
  deleteWebhook,
  handleGeneralWebhook,
  verifyFacebookWebhook,
  handleFacebookWebhook,
  getWebhookLogs
};
