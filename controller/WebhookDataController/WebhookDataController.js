const pool = require('../../config/DBConnection');
const axios = require('axios');
const systemAuditLogger = require('../../utils/systemAuditLogger');
const GmailService = require('../../services/GmailService');
const WebhookGmailNotificationService = require('../../services/WebhookGmailNotificationService');
const TextWebhookService = require('../../services/TextWebhookService');
const nodemailer = require('nodemailer');

// Ensure environment variables are loaded
require('dotenv').config({ path: require('path').join(__dirname, '../../config/config.env') });

// Helper function to get connection with retry logic
const getConnectionWithRetry = async (maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Log connection pool status before attempting connection
      if (attempt > 1) {
        console.log(`🔄 Connection pool status - Active: ${pool.pool._allConnections.length}, Free: ${pool.pool._freeConnections.length}`);
      }

      const connection = await pool.getConnection();

      // Log successful connection
      if (attempt > 1) {
        console.log(`✅ Database connection established on attempt ${attempt}`);
      }

      return connection;
    } catch (error) {
      console.error(`❌ Connection attempt ${attempt} failed:`, error.message);
      console.error(`🔍 Connection pool status - Active: ${pool.pool._allConnections.length}, Free: ${pool.pool._freeConnections.length}`);

      if (attempt === maxRetries) {
        throw new Error(`Failed to get database connection after ${maxRetries} attempts: ${error.message}`);
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

const VAPI_BASE_URL = process.env.VAPI_BASE_URL || 'https://api.vapi.ai';
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Store webhook data (First webhook - capture data)
const storeWebhookData = async (req, res) => {
  const { webhookId } = req.params;
  const webhookData = req.body;

  console.log(`📥 Webhook data received for webhook ${webhookId}:`, webhookData);

  // Verify webhook exists and is active before capturing/processing data
  try {
    const connection = await getConnectionWithRetry();
    try {
        let webhookRows = [];

        // Attempt to find webhook row by webhook_id first
        try {
          [webhookRows] = await connection.execute(
            `SELECT * FROM webhooks WHERE webhook_id = ?`,
            [webhookId]
          );
        } catch (err1) {
          if (err1.code !== 'ER_BAD_FIELD_ERROR') throw err1;
        }

        // Fallback: try by id if not found
        if (!webhookRows || webhookRows.length === 0) {
          try {
            [webhookRows] = await connection.execute(
              `SELECT * FROM webhooks WHERE id = ?`,
              [webhookId]
            );
          } catch (err2) {
            if (err2.code !== 'ER_BAD_FIELD_ERROR') throw err2;
          }
        }

        // If still not found, try a combined loose query (schema-agnostic)
        if (!webhookRows || webhookRows.length === 0) {
          try {
            [webhookRows] = await connection.execute(
              `SELECT * FROM webhooks WHERE (webhook_id = ? OR id = ?)`,
              [webhookId, webhookId]
            );
          } catch (err3) {
            // If even this fails because of schema, we will treat as not found
          }
        }

        if (!Array.isArray(webhookRows) || webhookRows.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Webhook not found or inactive'
          });
        }

        const webhookRecord = webhookRows[0] || {};
        const hasIsActive = Object.prototype.hasOwnProperty.call(webhookRecord, 'is_active');
        const hasStatus = Object.prototype.hasOwnProperty.call(webhookRecord, 'status');
        const isActiveFlag = hasIsActive ? Number(webhookRecord.is_active) === 1 : null;
        const isStatusActive = hasStatus ? String(webhookRecord.status || '').toLowerCase() === 'active' : null;

        // Active rules:
        // - If both fields exist: require BOTH (strict)
        // - If only is_active exists: require is_active = 1
        // - If only status exists: require status = 'active'
        let isAllowed = false;
        if (hasIsActive && hasStatus) {
          isAllowed = isActiveFlag === true && isStatusActive === true;
        } else if (hasIsActive) {
          isAllowed = isActiveFlag === true;
        } else if (hasStatus) {
          isAllowed = isStatusActive === true;
        }

        if (!isAllowed) {
          return res.status(404).json({
            success: false,
            message: 'Webhook not found or inactive'
          });
        }
      } finally {
        connection.release();
      }
    } catch (e) {
      console.error('❌ Error validating webhook status before capture:', e);
      return res.status(500).json({
        success: false,
        message: 'Failed to validate webhook status',
        error: e.message
      });
    }

    // Store the raw webhook data
    let dataConnection;
    try {
      dataConnection = await getConnectionWithRetry();
      const [result] = await dataConnection.execute(
        `INSERT INTO webhook_data (webhook_id, data, created_at, updated_at) 
         VALUES (?, ?, NOW(), NOW())`,
        [webhookId, JSON.stringify(webhookData)]
      );

      const dataId = result.insertId;
      console.log(`✅ Webhook data stored with ID: ${dataId}`);

      // Process the data through the workflow
      await processWebhookWorkflow(webhookId, dataId, webhookData);

      // Trigger second webhook for list storage if configured
      await triggerListStorageWebhook(webhookId, dataId, webhookData);

      res.status(200).json({
        success: true,
        message: 'Webhook data received and processed',
        data: {
          id: dataId,
          webhookId,
          capturedData: webhookData,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Error storing webhook data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to store webhook data',
        error: error.message
      });
    } finally {
      if (dataConnection) {
        try {
          dataConnection.release();
        } catch (releaseError) {
          console.error('Error releasing connection in storeWebhookData:', releaseError);
        }
      }
    }
};

// Process webhook workflow (Second webhook - process and store structured data)
const processWebhookWorkflow = async (webhookId, dataId, rawData) => {
  let connection;
  try {
    console.log(`🔄 Processing webhook workflow for webhook ${webhookId}`);

    // Get webhook configuration to understand the workflow
    connection = await getConnectionWithRetry();

    // Try to find webhook by webhook_id first, then by id
    let webhookRows;
    try {
      [webhookRows] = await connection.execute(
        'SELECT * FROM webhooks WHERE webhook_id = ?',
        [webhookId]
      );
    } catch (error) {
      // If webhook_id column doesn't exist, try with id
      [webhookRows] = await connection.execute(
        'SELECT * FROM webhooks WHERE id = ?',
        [webhookId]
      );
    }

      if (webhookRows.length === 0) {
        console.log(`❌ Webhook ${webhookId} not found in database`);
        return;
      }

      const webhook = webhookRows[0];
      // workflow_config is already an object when retrieved from MySQL JSON column
      const workflowConfig = webhook.workflow_config || {};

      console.log(`📋 Webhook workflow config:`, JSON.stringify(workflowConfig, null, 2));
      console.log(`👤 Webhook user_id: ${webhook.user_id}`);

      // Extract structured data based on workflow configuration
      const structuredData = extractStructuredData(rawData, workflowConfig);
      
      // Store structured data in contacts or appropriate table
      if (structuredData.email || structuredData.name) {
        await storeContactData(structuredData, webhook.user_id);
      }

      // Gmail notifications: only send if Gmail service is explicitly connected in actionCards
      console.log(`🔍 Checking for Gmail actions in workflow...`);
      console.log(`📋 Available actions:`, workflowConfig.actions?.map(a => ({ type: a.type, app: a.app?.id })));

      let gmailConnected = false;
      let gmailCard = null;
      let metadata = {};
      try {
        metadata = typeof webhook.metadata === 'string' ? JSON.parse(webhook.metadata || '{}') : (webhook.metadata || {});
        const actionCards = Array.isArray(metadata.actionCards) ? metadata.actionCards : [];
        gmailCard = actionCards.find(c => c?.selectedApp?.id === 'gmail-service');
        gmailConnected = Boolean(gmailCard?.isConnected);
      } catch (e) {
        gmailConnected = false;
        metadata = {};
      }

      if (gmailConnected && gmailCard) {
        console.log(`✅ Gmail service is connected via action card; processing email...`);

        // Check if enhanced Gmail configuration is available
        if (gmailCard.gmailConfig && gmailCard.gmailConfig.to) {
          console.log(`📧 Using enhanced Gmail configuration for sending email...`);
          try {
            await WebhookGmailNotificationService.sendGmailWithConfig(
              webhook.user_id,
              gmailCard.gmailConfig,
              structuredData
            );
            console.log(`✅ Enhanced Gmail email sent successfully`);
          } catch (gmailError) {
            console.error(`❌ Error sending enhanced Gmail email:`, gmailError);
            // Fall back to default notification
            await sendGmailNotification(webhook.user_id, structuredData, workflowConfig);
          }
        } else {
          console.log(`📧 Using default Gmail notification...`);
          await sendGmailNotification(webhook.user_id, structuredData, workflowConfig);
        }
      } else {
        console.log(`❌ Gmail service not connected; skipping email notification`);
      }

      // Process Lists actions from action cards
      await processListsActions(webhook, rawData, metadata, structuredData);

      // Check for outbound campaign action in both metadata.actionCards and workflow_config.actions
      await maybeTriggerOutboundCampaignFromWebhook(webhook, rawData, workflowConfig, structuredData);

      // Check for text webhook action in metadata.actionCards
      console.log(`🔍 Checking for text webhook actions in webhook metadata...`);
      console.log(`📋 Webhook metadata:`, JSON.stringify(webhook.metadata, null, 2));
      await TextWebhookService.processTextWebhookAction(webhook, rawData, structuredData);

      // Process Gmail actions from action cards
      if (gmailConnected && metadata.actionCards) {
        console.log(`📧 Processing Gmail actions from action cards...`);

        // Find Gmail service action cards
        const gmailActionCards = metadata.actionCards.filter(card =>
          card.selectedApp?.id === 'gmail-service' &&
          card.isConnected &&
          card.gmailConfig
        );

        if (gmailActionCards.length > 0) {
          console.log(`📧 Found ${gmailActionCards.length} Gmail action card(s) to process`);

          try {
            for (const gmailCard of gmailActionCards) {
              console.log(`📧 Processing Gmail action card:`, {
                cardId: gmailCard.id,
                fromEmail: gmailCard.gmailConfig.fromEmail,
                to: gmailCard.gmailConfig.to,
                subject: gmailCard.gmailConfig.subject
              });

              // Send email using the Gmail configuration from the action card
              await WebhookGmailNotificationService.sendGmailWithConfig(
                webhook.user_id,
                gmailCard.gmailConfig,
                rawData
              );
            }
            console.log(`✅ All Gmail action cards processed successfully`);
          } catch (gmailError) {
            console.error(`❌ Error processing Gmail action cards:`, gmailError);
            // Don't fail the webhook processing if Gmail notification fails
          }
        } else {
          console.log('ℹ️ No Gmail action cards found with configurations');
        }
      } else {
        console.log('✉️ Gmail service not connected or no action cards; skipping Gmail notifications');
      }

  } catch (error) {
    console.error('Error processing webhook workflow:', error);
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error releasing connection:', releaseError);
      }
    }
  }
};

// Extract structured data from raw webhook data
const extractStructuredData = (rawData, workflowConfig) => {
  const structured = {};

  // Common field mappings
  const fieldMappings = {
    email: ['email', 'Email', 'EMAIL', 'user_email', 'contact_email'],
    name: ['name', 'Name', 'NAME', 'full_name', 'fullName', 'first_name', 'firstName'],
    phone: ['phone', 'Phone', 'PHONE', 'phone_number', 'phoneNumber'],
    company: ['company', 'Company', 'COMPANY', 'organization'],
    message: ['message', 'Message', 'MESSAGE', 'comment', 'notes']
  };

  // Extract data using field mappings
  Object.keys(fieldMappings).forEach(field => {
    const possibleKeys = fieldMappings[field];
    for (const key of possibleKeys) {
      if (rawData[key]) {
        structured[field] = rawData[key];
        break;
      }
    }
  });

  // Add any additional custom fields
  Object.keys(rawData).forEach(key => {
    if (!Object.values(fieldMappings).flat().includes(key)) {
      structured[`custom_${key}`] = rawData[key];
    }
  });

  console.log(`📊 Extracted structured data:`, structured);
  return structured;
};

// Store contact data (Second webhook - database storage)
const storeContactData = async (data, userId) => {
  try {
    if (!data.email && !data.name) {
      console.log('⚠️ No email or name found, skipping contact storage');
      return;
    }

    const connection = await getConnectionWithRetry();
    try {
      // Check if contact already exists
      const [existingContacts] = await connection.execute(
        'SELECT id FROM contacts WHERE email = ? AND userId = ?',
        [data.email || '', userId]
      );

      if (existingContacts.length > 0) {
        // Update existing contact (never pass undefined to MySQL bindings)
        await connection.execute(
          `UPDATE contacts SET
           fullName = COALESCE(?, fullName),
           phoneNumber = COALESCE(?, phoneNumber),
           company = COALESCE(?, company),
           updatedAt = NOW()
           WHERE id = ?`,
          [
            data.name ?? null,
            data.phone ?? null,
            data.company ?? null,
            existingContacts[0].id
          ]
        );
        console.log(`✅ Updated existing contact: ${data.email}`);
      } else {
        // Create new contact - first ensure we have a default list
        let defaultListId = await ensureDefaultList(connection, userId);

        await connection.execute(
          `INSERT INTO contacts (userId, fullName, email, phoneNumber, company, source, listId, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, 'webhook', ?, NOW(), NOW())`,
          [userId, data.name || '', data.email || '', data.phone || '', data.company || '', defaultListId]
        );
        console.log(`✅ Created new contact: ${data.email}`);
      }

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error storing contact data:', error);
  }
};

// Send Gmail notification (Gmail service action - using server SMTP)
const sendGmailNotification = async (userId, data, workflowConfig) => {
  try {
    console.log(`📧 Sending Gmail notification for user ${userId}`);

    // Find Gmail action configuration
    const gmailAction = workflowConfig.actions?.find(action => action.type === 'gmail-service');
    if (!gmailAction) {
      console.log('❌ No Gmail action configured');
      console.log('Available actions:', workflowConfig.actions?.map(a => ({ type: a.type, app: a.app?.id })));
      return;
    }

    console.log(`📧 Gmail action found:`, JSON.stringify(gmailAction, null, 2));

    // Use server SMTP for sending emails (not user's personal Gmail)
    // Note: EmailService is a class, so we need to instantiate it properly

    // Get recipient email from action config or use user's email as fallback
    let recipientEmail = gmailAction.to;

    // If no recipient specified, get user's email from database
    if (!recipientEmail) {
      const connection = await getConnectionWithRetry();
      try {
        const [users] = await connection.execute(
          'SELECT email FROM users WHERE id = ?',
          [userId]
        );
        if (users.length > 0) {
          recipientEmail = users[0].email;
        }
      } finally {
        connection.release();
      }
    }

    if (!recipientEmail) {
      console.log('❌ No recipient email found for Gmail notification');
      return;
    }

    // Prepare email content
    const emailData = {
      to: recipientEmail,
      subject: gmailAction.subject || `New Webhook Data: ${data.name || data.email || 'Unknown'}`,
      body: generateEmailBody(data, workflowConfig),
      isHtml: true
    };

    console.log(`📧 Sending email to: ${emailData.to} with subject: ${emailData.subject}`);

    // Send email using server SMTP
    const emailResult = await sendEmailViaServerSMTP(emailData);
    if (emailResult.success) {
      console.log(`✅ Gmail notification sent successfully via ${emailResult.provider}`);
    } else {
      console.log(`❌ Gmail notification failed: ${emailResult.error}`);
    }

  } catch (error) {
    console.error('Error sending Gmail notification:', error);
  }
};

// Send email via server SMTP configuration
const sendEmailViaServerSMTP = async (emailData) => {
  try {
    console.log(`📤 Sending email via server SMTP to: ${emailData.to}`);


    // Check if SMTP is configured
    const hasSmtpConfig = process.env.SMTP_USER &&
                         process.env.SMTP_PASS &&
                         process.env.SMTP_USER !== 'your_email@gmail.com' &&
                         process.env.SMTP_USER !== 'info@example.com';

    if (!hasSmtpConfig) {
      console.log('⚠️  SMTP not configured, using test mode');
      console.log("📧 EMAIL WOULD BE SENT:");
      console.log("=".repeat(50));
      console.log(`To: ${emailData.to}`);
      console.log(`Subject: ${emailData.subject}`);
      console.log(`Body: ${emailData.body.substring(0, 200)}...`);
      console.log("=".repeat(50));

      return {
        success: true,
        messageId: "test-mode-" + Date.now(),
        provider: 'test-mode'
      };
    }

    // Create transporter using server SMTP configuration
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.hostinger.com',
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify transporter configuration
    await transporter.verify();
    console.log('✅ Server SMTP configuration verified');

    // Prepare mail options
    const mailOptions = {
      from: `"${process.env.APP_NAME || 'AI CRUITMENT'}" <${process.env.SMTP_USER}>`,
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.body
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully via server SMTP: ${info.messageId}`);

    return {
      success: true,
      messageId: info.messageId,
      provider: 'server-smtp'
    };

  } catch (error) {
    console.error('❌ Error sending email via server SMTP:', error);

    // Return error instead of throwing to prevent webhook failure
    return {
      success: false,
      error: error.message,
      provider: 'server-smtp-failed'
    };
  }
};

// Ensure default list exists for user
const ensureDefaultList = async (connection, userId) => {
  try {
    // Check if user has any lists
    const [existingLists] = await connection.execute(
      'SELECT id FROM lists WHERE userId = ? LIMIT 1',
      [userId]
    );

    if (existingLists.length > 0) {
      return existingLists[0].id;
    }

    // Create default list for user
    const [result] = await connection.execute(
      `INSERT INTO lists (userId, name, description, createdAt, updatedAt)
       VALUES (?, 'Webhook Contacts', 'Contacts from webhook submissions', NOW(), NOW())`,
      [userId]
    );

    console.log(`✅ Created default list for user ${userId}: ${result.insertId}`);
    return result.insertId;

  } catch (error) {
    console.error('Error ensuring default list:', error);
    // Fallback: try to find any list for this user or create one
    return 1; // Fallback to ID 1
  }
};

// Generate email body from webhook data
const generateEmailBody = (data, workflowConfig) => {
  let body = `
    <h2>New Webhook Data Received</h2>
    <p>A new submission has been received through your webhook.</p>
    
    <h3>Contact Information:</h3>
    <ul>
  `;

  if (data.name) body += `<li><strong>Name:</strong> ${data.name}</li>`;
  if (data.email) body += `<li><strong>Email:</strong> ${data.email}</li>`;
  if (data.phone) body += `<li><strong>Phone:</strong> ${data.phone}</li>`;
  if (data.company) body += `<li><strong>Company:</strong> ${data.company}</li>`;
  if (data.message) body += `<li><strong>Message:</strong> ${data.message}</li>`;

  body += `</ul>`;

  // Add custom fields
  const customFields = Object.keys(data).filter(key => key.startsWith('custom_'));
  if (customFields.length > 0) {
    body += `<h3>Additional Information:</h3><ul>`;
    customFields.forEach(field => {
      const displayName = field.replace('custom_', '').replace(/_/g, ' ');
      body += `<li><strong>${displayName}:</strong> ${data[field]}</li>`;
    });
    body += `</ul>`;
  }

  body += `
    <hr>
    <p><small>This email was sent automatically by your AI CRUITMENT webhook workflow.</small></p>
  `;

  return body;
};

// Get webhook data history
const getWebhookData = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const connection = await getConnectionWithRetry();
    try {
      // Validate and sanitize limit and offset
      const limitValue = Math.max(1, Math.min(100, parseInt(limit) || 10));
      const offsetValue = Math.max(0, parseInt(offset) || 0);

      const [rows] = await connection.execute(
        `SELECT * FROM webhook_data
         WHERE webhook_id = ?
         ORDER BY created_at DESC
         LIMIT ${limitValue} OFFSET ${offsetValue}`,
        [webhookId]
      );

      const [countRows] = await connection.execute(
        'SELECT COUNT(*) as total FROM webhook_data WHERE webhook_id = ?',
        [webhookId]
      );

      res.status(200).json({
        success: true,
        data: {
          webhookData: rows.map(row => ({
            ...row,
            data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data
          })),
          total: countRows[0].total,
          page: parseInt(page),
          limit: parseInt(limit)
        }
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Error getting webhook data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get webhook data',
      error: error.message
    });
  }
};

// Test webhook data (for testing webhook workflows)
const testWebhookData = async (req, res) => {
  try {
    const { webhookId } = req.params;
    const userId = req.user?.id;

    console.log(`🧪 Testing webhook ${webhookId} for user ${userId}`);

    // Create test data
    const testData = {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1234567890',
      message: 'This is a test webhook submission',
      source: 'webhook_test',
      timestamp: new Date().toISOString(),
      test: true
    };

    // Process the test data through the webhook workflow
    await processWebhookWorkflow(webhookId, 'test', testData);

    res.status(200).json({
      success: true,
      message: 'Test webhook data processed successfully',
      data: { webhookId, testData }
    });

  } catch (error) {
    console.error('Error testing webhook data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test webhook data',
      error: error.message
    });
  }
};

// Trigger second webhook for list storage
const triggerListStorageWebhook = async (webhookId, dataId, webhookData) => {
  let connection;
  try {
    console.log(`🔗 Triggering list storage webhook for webhook ${webhookId}`);

    connection = await getConnectionWithRetry();
      // Get the main webhook configuration
      const [webhookRows] = await connection.execute(
        `SELECT user_id, metadata FROM webhooks WHERE webhook_id = ? AND status = 'active'`,
        [webhookId]
      );

      if (webhookRows.length === 0) {
        console.log('❌ Main webhook not found or inactive');
        return;
      }

      const webhook = webhookRows[0];
      let metadata = {};

      try {
        metadata = typeof webhook.metadata === 'string' ? JSON.parse(webhook.metadata) : (webhook.metadata || {});
      } catch (e) {
        console.log('❌ Error parsing webhook metadata');
        return;
      }

      // Check if list storage is configured
      const listConfig = metadata.configuration?.lists;
      if (!listConfig || !listConfig.listId) {
        console.log('❌ No list configuration found for webhook');
        return;
      }

      console.log(`📋 List configuration found: List ID ${listConfig.listId}`);

      // Create second webhook entry for list storage
      const listWebhookId = `${webhookId}_list_${listConfig.listId}`;

      // Check if list storage webhook already exists
      const [existingListWebhook] = await connection.execute(
        `SELECT webhook_id FROM webhooks WHERE webhook_id = ?`,
        [listWebhookId]
      );

      if (existingListWebhook.length === 0) {
        // Create the list storage webhook
        await connection.execute(
          `INSERT INTO webhooks (
            webhook_id, user_id, name, trigger_type, description,
            workflow_config, url, status, is_active, events, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, NOW(), NOW())`,
          [
            listWebhookId,
            webhook.user_id,
            `List Storage - ${listConfig.listId}`,
            'list-storage',
            `Automatically stores data from webhook ${webhookId} into list ${listConfig.listId}`,
            JSON.stringify({
              sourceWebhookId: webhookId,
              targetListId: listConfig.listId,
              autoTrigger: true
            }),
            `${process.env.BACKEND_URL || 'https://ai.research-hero.com'}/api/webhook-data/list-storage/${listWebhookId}`,
            JSON.stringify(['list-storage'])
          ]
        );

        console.log(`✅ Created list storage webhook: ${listWebhookId}`);
      }

      // Store the data in the configured list
      await storeDataInList(webhook.user_id, listConfig.listId, webhookData, webhookId, dataId);

      console.log(`✅ Data stored in list ${listConfig.listId} via second webhook`);

  } catch (error) {
    console.error('❌ Error triggering list storage webhook:', error);
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error releasing connection in triggerListStorageWebhook:', releaseError);
      }
    }
  }
};

// Store data in specific list (Second webhook functionality)
const storeDataInList = async (userId, listId, webhookData, sourceWebhookId, dataId) => {
  let connection;
  try {
    console.log(`💾 Storing data in list ${listId} from webhook ${sourceWebhookId}`);

    connection = await getConnectionWithRetry();
      // Verify list exists and user owns it
      const [listRows] = await connection.execute(
        `SELECT id, listName FROM lists WHERE id = ? AND userId = ?`,
        [listId, userId]
      );

      if (listRows.length === 0) {
        console.log(`❌ List ${listId} not found or access denied for user ${userId}`);
        return;
      }

      const listName = listRows[0].listName;
      console.log(`📋 Storing data in list: ${listName}`);

      // Extract contact information from webhook data
      const email = webhookData.email || webhookData.emailAddress || webhookData.Email || '';
      const name = webhookData.name || webhookData.fullName || webhookData.Name || email.split('@')[0] || 'Unknown';
      const phone = webhookData.phone || webhookData.phoneNumber || webhookData.Phone || '';

      // Check if contact already exists in this list
      const [existingContacts] = await connection.execute(
        `SELECT id FROM contacts WHERE email = ? AND listId = ?`,
        [email, listId]
      );

      if (existingContacts.length > 0) {
        console.log(`⚠️ Contact ${email} already exists in list ${listId}`);
        return;
      }

      // Insert new contact
      const [result] = await connection.execute(
        `INSERT INTO contacts (email, fullName, phoneNumber, listId, createdAt)
         VALUES (?, ?, ?, ?, NOW())`,
        [email, name, phone, listId]
      );

      // Update list contact count
      await connection.execute(
        'UPDATE lists SET contacts_count = contacts_count + 1 WHERE id = ?',
        [listId]
      );

      // Log the list storage action
      await connection.execute(
        `INSERT INTO webhook_data (webhook_id, data, processed, created_at, updated_at)
         VALUES (?, ?, 1, NOW(), NOW())`,
        [`${sourceWebhookId}_list_storage`, JSON.stringify({
          action: 'list_storage',
          sourceWebhookId: sourceWebhookId,
          sourceDataId: dataId,
          listId: listId,
          listName: listName,
          contactId: result.insertId,
          contactEmail: email,
          contactName: name,
          originalData: webhookData
        })]
      );

      console.log(`✅ Contact ${email} added to list ${listName} (ID: ${result.insertId})`);

  } catch (error) {
    console.error('❌ Error storing data in list:', error);
  } finally {
    if (connection) {
      try {
        connection.release();
      } catch (releaseError) {
        console.error('Error releasing connection in storeDataInList:', releaseError);
      }
    }
  }
};

// List storage webhook endpoint handler
const handleListStorageWebhook = async (req, res) => {
  const { webhookId } = req.params;
  const webhookData = req.body;

  console.log(`📥 List storage webhook triggered for ${webhookId}:`, webhookData);

  // Extract the source webhook ID and list ID from the webhook ID
  const parts = webhookId.split('_list_');
  if (parts.length !== 2) {
    return res.status(400).json({
      success: false,
      message: 'Invalid list storage webhook ID format'
    });
  }

  const sourceWebhookId = parts[0];
  const listId = parts[1];

  let connection;
  try {
    connection = await getConnectionWithRetry();
      // Get the list storage webhook configuration
      const [webhookRows] = await connection.execute(
        `SELECT user_id, workflow_config FROM webhooks WHERE webhook_id = ? AND status = 'active'`,
        [webhookId]
      );

      if (webhookRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'List storage webhook not found or inactive'
        });
      }

      const webhook = webhookRows[0];
      let workflowConfig = {};

      try {
        workflowConfig = typeof webhook.workflow_config === 'string' ?
          JSON.parse(webhook.workflow_config) : (webhook.workflow_config || {});
      } catch (e) {
        console.log('❌ Error parsing workflow config');
      }

      // Store the data in the target list
      await storeDataInList(webhook.user_id, workflowConfig.targetListId || listId, webhookData, sourceWebhookId, 'manual');

      res.status(200).json({
        success: true,
        message: 'Data stored in list successfully',
        data: {
          webhookId,
          sourceWebhookId,
          listId: workflowConfig.targetListId || listId,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error handling list storage webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process list storage webhook',
        error: error.message
      });
    } finally {
      if (connection) {
        try {
          connection.release();
        } catch (releaseError) {
          console.error('Error releasing connection in handleListStorageWebhook:', releaseError);
        }
      }
    }
};

// Helper: normalize phone to E.164
const normalizePhoneToE164 = (rawNumber) => {
  if (!rawNumber || typeof rawNumber !== 'string') return '';
  const trimmed = rawNumber.trim();
  if (/^\+[1-9]\d{6,14}$/.test(trimmed)) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return '';
  if (/^[1-9]\d{6,14}$/.test(digits)) return `+${digits}`;
  const defaultCc = (process.env.DEFAULT_CALLING_COUNTRY_CODE || '+1').replace(/\D/g, '1');
  return `+${defaultCc}${digits}`;
};

// Helper: resolve assistant to VAPI UUID using local DB if a numeric/local id is provided
const resolveAssistantIdToVapiId = async (assistantId) => {
  try {
    if (!assistantId) return null;
    const idStr = String(assistantId).trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(idStr)) return idStr;

    const connection = await getConnectionWithRetry();
    try {
      // First try by local numeric id
      if (/^\d+$/.test(idStr)) {
        const [rows] = await connection.execute(
          'SELECT assistant_id FROM assistants WHERE id = ? LIMIT 1',
          [parseInt(idStr)]
        );
        if (rows.length > 0 && rows[0].assistant_id) return rows[0].assistant_id;
      }

      // Fallback: maybe the provided value is already assistant_id in DB
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

// Process Lists actions from action cards
const processListsActions = async (webhook, rawData, metadata, structuredData) => {
  try {
    console.log('📋 Processing Lists actions from action cards...');

    const actionCards = metadata.actionCards || [];
    console.log('📋 Found', actionCards.length, 'action cards');

    // Find Lists action card
    const listsAction = actionCards.find(card =>
      card.selectedApp?.id === 'lists' && card.isConnected
    );

    if (!listsAction) {
      console.log('ℹ️ No connected Lists action found');
      return;
    }

    console.log('📋 Lists action details:', {
      selectedApp: listsAction.selectedApp,
      selectedEvent: listsAction.selectedEvent,
      selectedListId: listsAction.selectedListId,
      isConnected: listsAction.isConnected
    });

    // Get the configured list ID
    const listId = listsAction.selectedListId;

    if (!listId) {
      console.log('❌ No list configured in Lists action');
      return;
    }

    // Prepare contact data from structured data
    const contactData = {
      email: structuredData.email || rawData.email || rawData.emailAddress,
      name: structuredData.name || rawData.name || rawData.fullName,
      phone: structuredData.phone || rawData.phone || rawData.phoneNumber,
      company: structuredData.company || rawData.company,
      message: structuredData.message || rawData.message
    };

    if (!contactData.email && !contactData.phone) {
      console.log('❌ No email or phone found for contact - skipping list addition');
      return;
    }

    // Add contact to the specified list
    await addDynamicContactToList(webhook.user_id, listId, contactData);

    console.log(`✅ Contact added to list ${listId}:`, {
      email: contactData.email,
      name: contactData.name,
      phone: contactData.phone
    });

  } catch (error) {
    console.error('❌ Error processing Lists actions:', error);
  }
};

// Helper function to add contact to list dynamically
const addDynamicContactToList = async (userId, listId, contactData) => {
  let connection;
  try {
    connection = await getConnectionWithRetry();

    // Check if contact already exists in this list
    const [existingContacts] = await connection.execute(
      'SELECT id FROM contacts WHERE user_id = ? AND list_id = ? AND (email = ? OR contact_number = ?)',
      [userId, listId, contactData.email || '', contactData.phone || '']
    );

    if (existingContacts.length > 0) {
      console.log('ℹ️ Contact already exists in list, updating...');
      // Update existing contact
      await connection.execute(
        `UPDATE contacts SET
         name = COALESCE(?, name),
         email = COALESCE(?, email),
         contact_number = COALESCE(?, contact_number),
         company = COALESCE(?, company),
         updated_at = NOW()
         WHERE id = ?`,
        [
          contactData.name || null,
          contactData.email || null,
          contactData.phone || null,
          contactData.company || null,
          existingContacts[0].id
        ]
      );
    } else {
      // Insert new contact
      await connection.execute(
        `INSERT INTO contacts (user_id, list_id, name, email, contact_number, company, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          userId,
          listId,
          contactData.name || 'Unknown',
          contactData.email || null,
          contactData.phone || null,
          contactData.company || null
        ]
      );
    }

  } finally {
    if (connection) {
      connection.release();
    }
  }
};

// Create VAPI campaign from webhook metadata action card if configured
const maybeTriggerOutboundCampaignFromWebhook = async (webhook, rawData, workflowConfig, structuredData) => {
  try {
    if (!webhook) return;
    let metadata = {};
    try {
      metadata = typeof webhook.metadata === 'string' ? JSON.parse(webhook.metadata) : (webhook.metadata || {});
    } catch (e) {
      metadata = {};
    }

    const actionCards = metadata.actionCards || [];
    console.log(`📋 Processing ${actionCards.length} action cards for campaigns`);
    console.log('🔍 Full metadata:', JSON.stringify(metadata, null, 2));
    let cfg = null;

    // 1) Check UI actionCards structure
    const campaignCard = Array.isArray(actionCards)
      ? actionCards.find(c => c?.selectedApp?.id === 'outbound-campaign')
      : null;

    console.log('🔍 Campaign card found:', campaignCard);
    if (campaignCard) {
      console.log('📋 Campaign card details:', {
        id: campaignCard.id,
        isConnected: campaignCard.isConnected,
        selectedEvent: campaignCard.selectedEvent,
        hasCampaignConfig: !!campaignCard.campaignConfig,
        campaignConfig: campaignCard.campaignConfig
      });
    }

    if (campaignCard && campaignCard.campaignConfig) {
      cfg = campaignCard.campaignConfig;
      console.log('✅ Using campaign config from action card:', cfg);
    } else if (campaignCard && campaignCard.selectedApp?.id === 'outbound-campaign') {
      console.log('⚠️ Campaign card found but no campaignConfig - using default config');
      // Create a default campaign config if the card exists but has no config
      cfg = {
        name: `Webhook Campaign - ${new Date().toISOString().slice(0,10)}`,
        phoneNumberId: process.env.DEFAULT_VAPI_PHONE_NUMBER_ID || process.env.VAPI_PHONE_NUMBER_ID,
        assistantId: process.env.DEFAULT_VAPI_ASSISTANT_ID,
        autoLaunch: true
      };
      console.log('🔧 Using default campaign config:', cfg);
    } else if (campaignCard) {
      console.log('❌ Campaign card found but no campaignConfig or not connected');
    }

    // 2) Also check workflow_config.actions for a minimal campaign definition
    if (!cfg && workflowConfig && Array.isArray(workflowConfig.actions)) {
      const wfCampaign = workflowConfig.actions.find(a => a.type === 'outbound-campaign' || a.type === 'campaign');
      if (wfCampaign) {
        cfg = {
          name: wfCampaign.name,
          phoneNumberId: wfCampaign.phoneNumberId,
          assistantId: wfCampaign.assistantId,
          workflowId: wfCampaign.workflowId,
          autoLaunch: wfCampaign.autoLaunch
        };
      }
    }

    if (!cfg) {
      // Fallback: if the workflow has been configured (e.g., lists configured) but no campaign card is persisted yet,
      // attempt to use default env-based campaign config so the independent action still runs.
      try {
        let metaObj = {};
        try { metaObj = typeof webhook.metadata === 'string' ? JSON.parse(webhook.metadata || '{}') : (webhook.metadata || {}); } catch {}
        const hasListsConfigured = Boolean(metaObj?.configuration?.lists?.listId);
        const defaultPhone = process.env.DEFAULT_VAPI_PHONE_NUMBER_ID;
        const defaultAssistant = process.env.DEFAULT_VAPI_ASSISTANT_ID;
        if (hasListsConfigured && defaultPhone && (defaultAssistant || workflowConfig?.defaultAssistantId)) {
          cfg = {
            name: `Webhook Campaign - ${new Date().toISOString().slice(0,10)}`,
            phoneNumberId: defaultPhone,
            assistantId: defaultAssistant || workflowConfig?.defaultAssistantId,
            autoLaunch: true
          };
          console.log('🔧 Using fallback default campaign config due to missing action card:', cfg);
        }
      } catch {}

      if (!cfg) {
        console.log('ℹ️ No outbound campaign configuration found in webhook');
        return;
      }
    }

    // Apply safe fallbacks so partial configs still work
    let phoneNumberId = cfg.phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID;
    let assistantId = cfg.assistantId;
    const workflowId = cfg.workflowId;
    const autoLaunch = Boolean(cfg.autoLaunch);
    const campaignName = cfg.name || `Webhook Campaign - ${new Date().toISOString().slice(0,10)}`;

    if (!assistantId && !workflowId && process.env.DEFAULT_VAPI_ASSISTANT_ID) {
      console.log('ℹ️ No assistantId/workflowId provided; falling back to DEFAULT_VAPI_ASSISTANT_ID');
      assistantId = process.env.DEFAULT_VAPI_ASSISTANT_ID;
    }

    // Always try to get a valid phone number from user's phone_numbers table (env might be invalid)
    console.log('🔍 Current phoneNumberId from env:', phoneNumberId);
    try {
      const conn = await getConnectionWithRetry();
      try {
        const [rows] = await conn.execute(
          'SELECT phone_number_id FROM phone_numbers WHERE user_id = ? ORDER BY id DESC LIMIT 1',
          [webhook.user_id]
        );
        console.log('📞 Found', rows.length, 'phone numbers in DB for user', webhook.user_id);
        if (rows.length > 0 && rows[0].phone_number_id) {
          const dbPhoneId = rows[0].phone_number_id;
          console.log('ℹ️ Using phone number from DB instead of env:', dbPhoneId);
          phoneNumberId = dbPhoneId;
        } else {
          console.log('⚠️ No phone numbers found in DB for user', webhook.user_id);
        }
      } finally {
        conn.release();
      }
    } catch (e) {
      console.log('⚠️ Failed to fetch phone number from DB:', e.message);
    }

    if (!phoneNumberId) {
      console.log('❌ Campaign config missing phoneNumberId; skipping campaign but continuing with other actions');
      return;
    }

    // Validate phone number exists in VAPI before creating campaign
    console.log('🔍 Validating phone number with VAPI:', phoneNumberId);
    try {
      const vapiResponse = await axios.get(`https://api.vapi.ai/phone-number/${phoneNumberId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.VAPI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('✅ Phone number validated with VAPI');
    } catch (vapiError) {
      console.log('❌ Phone number validation failed:', vapiError.response?.data?.message || vapiError.message);
      console.log('⚠️ Skipping campaign creation due to invalid phone number, but continuing with other actions');
      return;
    }

    // If neither assistantId nor workflowId is provided, try to fetch a default assistant from DB for this user
    if (!assistantId && !workflowId) {
      try {
        const conn = await getConnectionWithRetry();
        try {
          const [rows] = await conn.execute(
            'SELECT assistant_id FROM assistants WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [webhook.user_id]
          );
          if (rows.length > 0 && rows[0].assistant_id) {
            assistantId = rows[0].assistant_id;
            console.log('ℹ️ Using assistant from DB as fallback:', assistantId);
          }
        } finally {
          conn.release();
        }
      } catch (e) {
        console.log('⚠️ Failed to fetch assistant from DB as fallback:', e.message);
      }
    }

    if (!assistantId && !workflowId) {
      console.log('❌ Campaign config requires assistantId or workflowId (no default available); skipping');
      return;
    }

    // Extract phone from structured or raw payload
    const phone =
      structuredData?.phone ||
      rawData.phone || rawData.phoneNumber || rawData.mobile || rawData.Phone || rawData.phone_number ||
      (rawData.data && (rawData.data.phone || rawData.data.phoneNumber || rawData.data.mobile)) ||
      (rawData.payload && (rawData.payload.phone || rawData.payload.phoneNumber || rawData.payload.mobile)) ||
      '';
    const normalized = normalizePhoneToE164(phone);
    if (!normalized) {
      console.log('❌ No valid phone number in webhook payload; skipping campaign');
      return;
    }

    const name = structuredData?.name || rawData.fullName || rawData.name || rawData.firstName || rawData.first_name || rawData.email || 'Lead';
    const email = structuredData?.email || rawData.email || rawData.emailAddress || undefined;

    // Resolve assistant id to a VAPI UUID when a local id is provided
    const vapiAssistantId = await resolveAssistantIdToVapiId(assistantId);

    const campaignData = {
      name: campaignName,
      phoneNumberId,
      customers: [ { name, number: normalized, email } ],
      ...(vapiAssistantId ? { assistantId: vapiAssistantId } : {}),
      ...(workflowId ? { workflowId } : {})
    };

    console.log('🚀 Creating VAPI campaign (webhook-data flow):', campaignData);
    const response = await axios.post(`${VAPI_BASE_URL}/campaign`, campaignData, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ VAPI campaign created:', response.data?.id, response.data?.status);

    // Best-effort launch: if scheduled, try setting in-progress even when autoLaunch is false
    console.log('🔄 Attempting to launch campaign:', response.data?.id, 'autoLaunch:', autoLaunch);
    try {
      console.log('⏳ Waiting 800ms before checking campaign status...');
      await new Promise(r => setTimeout(r, 800));

      console.log('🔍 Checking campaign status...');
      const statusResp = await axios.get(`${VAPI_BASE_URL}/campaign/${response.data.id}`, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📊 Campaign status check result:', statusResp.data?.status);

      if (statusResp.data?.status === 'scheduled') {
        console.log('🚀 Campaign is scheduled, attempting to launch...');
        await axios.patch(`${VAPI_BASE_URL}/campaign/${response.data.id}`, { status: 'in-progress' }, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        });
        console.log('📞 Campaign launched from scheduled state');
      } else {
        console.log('ℹ️ Campaign status is not scheduled:', statusResp.data?.status);
      }
    } catch (e) {
      console.log('⚠️ Launch check/attempt failed (non-fatal):', e.response?.data || e.message);
    }
  } catch (error) {
    console.error('❌ Error triggering outbound campaign from webhook-data:', error.response?.data || error.message);
  }
};

module.exports = {
  storeWebhookData,
  testWebhookData,
  getWebhookData,
  processWebhookWorkflow,
  sendGmailNotification,
  triggerListStorageWebhook,
  storeDataInList,
  handleListStorageWebhook
};
