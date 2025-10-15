const GmailService = require('../services/GmailService');
const pool = require('../config/DBConnection');
const { google } = require('googleapis');
const axios = require('axios');
require('dotenv').config();

class GmailWebhookController {
  constructor() {
    this.gmailService = new GmailService();
  }

  // Handle Gmail push notifications
  async handleGmailPushNotification(req, res) {
    try {
      console.log('📧 Gmail push notification received:', {
        headers: req.headers,
        query: req.query,
        body: req.body
      });

      // Acknowledge the notification immediately
      res.status(200).send();

      // Process the notification asynchronously
      // Note: Google requires a response within 30 seconds, so we acknowledge first
      // and process the actual work in the background
      this.processGmailNotificationInBackground();
    } catch (error) {
      console.error('Error handling Gmail push notification:', error);
      // We still send 200 to avoid Google retrying
      res.status(200).send();
    }
  }

  // Process Gmail notification in background
  async processGmailNotificationInBackground(notificationData = null) {
    try {
      console.log('🔄 Processing Gmail notification in background');

      // Get all users with active Gmail webhooks
      const connection = await pool.getConnection();
      try {
        const [webhooks] = await connection.execute(
          `SELECT w.id, w.user_id, w.url, w.trigger_type, w.name, w.workflow_config
           FROM webhooks w
           WHERE w.trigger_type = 'gmail' AND w.is_active = 1`
        );

        console.log(`🔍 Found ${webhooks.length} active Gmail webhooks`);

        for (const webhook of webhooks) {
          try {
            console.log(`🔄 Processing Gmail webhook for user ${webhook.user_id}`);

            // Process new emails for this user
            await this.processNewEmailsForWebhook(webhook.user_id, webhook);
          } catch (error) {
            console.error(`Error processing Gmail webhook for user ${webhook.user_id}:`, error);
          }
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error processing Gmail notifications:', error);
    }
  }

  // Process new emails for all users (manual trigger)
  async processNewEmails(userId) {
    try {
      console.log(`🔄 Manually processing new emails for user ${userId}`);

      // Get all active Gmail webhooks for this user
      const connection = await pool.getConnection();
      try {
        const [webhooks] = await connection.execute(
          `SELECT w.id, w.user_id, w.url, w.trigger_type, w.name, w.workflow_config
           FROM webhooks w
           WHERE w.trigger_type = 'gmail' AND w.is_active = 1 AND w.user_id = ?`,
          [userId]
        );

        console.log(`🔍 Found ${webhooks.length} active Gmail webhooks for user ${userId}`);

        for (const webhook of webhooks) {
          try {
            await this.processNewEmailsForWebhook(webhook.user_id, webhook);
          } catch (error) {
            console.error(`Error processing Gmail webhook ${webhook.id} for user ${webhook.user_id}:`, error);
          }
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error(`Error processing new emails for user ${userId}:`, error);
      throw error;
    }
  }

  // Process new emails for a specific webhook
  async processNewEmailsForWebhook(userId, webhook) {
    try {
      console.log(`🔍 Processing new emails for user ${userId} with webhook ${webhook.id}`);
      
      // Set up user authentication
      await this.gmailService.setupUserAuth(userId);
      
      // List recent messages based on workflow configuration
      let query = 'is:unread';
      let maxResults = 10;

      // Parse workflow config to determine trigger conditions (enhanced from gmail-code)
      const workflowConfig = webhook.workflow_config || {};
      const triggerConfig = workflowConfig.trigger || {};

      // Enhanced trigger configuration with label filtering (from gmail-code reference)
      if (triggerConfig.labelId) {
        // Use specific label ID for filtering (gmail-code style)
        query = `label:${triggerConfig.labelId}`;
      } else if (triggerConfig.labelName) {
        // Use label name for filtering
        query = `label:"${triggerConfig.labelName}"`;
      }

      // Handle different trigger events based on workflow config
      if (triggerConfig.event === 'new-email-with-attachment' ||
          (triggerConfig.filters && triggerConfig.filters.hasAttachment)) {
        query += ' has:attachment';
      }

      // Enhanced filtering options (from gmail-code reference)
      if (triggerConfig.filters) {
        if (triggerConfig.filters.fromSender) {
          query += ` from:${triggerConfig.filters.fromSender}`;
        }
        if (triggerConfig.filters.toRecipient) {
          query += ` to:${triggerConfig.filters.toRecipient}`;
        }
        if (triggerConfig.filters.subjectKeyword) {
          query += ` subject:"${triggerConfig.filters.subjectKeyword}"`;
        }
        if (triggerConfig.filters.bodyKeyword) {
          query += ` "${triggerConfig.filters.bodyKeyword}"`;
        }
        if (triggerConfig.filters.label) {
          query += ` label:"${triggerConfig.filters.label}"`;
        }
        if (triggerConfig.filters.isImportant) {
          query += ' is:important';
        }
        if (triggerConfig.filters.isStarred) {
          query += ' is:starred';
        }
        if (triggerConfig.filters.excludePromotions) {
          query += ' -category:promotions';
        }
        if (triggerConfig.filters.excludeSocial) {
          query += ' -category:social';
        }
        if (triggerConfig.filters.excludeUpdates) {
          query += ' -category:updates';
        }
        if (triggerConfig.filters.dateRange) {
          // Support date filtering (newer_than:1d, older_than:7d, etc.)
          query += ` ${triggerConfig.filters.dateRange}`;
        }
      }

      // Enhanced polling configuration (from gmail-code reference)
      if (triggerConfig.maxResults) {
        maxResults = Math.min(parseInt(triggerConfig.maxResults), 500); // Gmail API limit
      }

      // Support for polling interval configuration
      const pollInterval = triggerConfig.pollInterval || 15; // Default 15 minutes like gmail-code
      console.log(`⏱️ Using poll interval: ${pollInterval} minutes for webhook ${webhook.id}`);

      console.log(`📧 Searching emails with query: "${query}" for user ${userId}`);
      const messages = await this.gmailService.listEmails(userId, query, maxResults);
      
      const connection = await pool.getConnection();
      try {
        for (const message of messages) {
          try {
            // Check if email is already processed for this webhook
            const [existing] = await connection.execute(
              'SELECT id FROM gmail_webhook_triggers WHERE user_id = ? AND message_id = ? AND webhook_id = ?',
              [userId, message.id, webhook.id]
            );
            
            if (existing.length > 0) {
              continue; // Skip already processed emails for this webhook
            }
            
            // Get full email details
            const email = await this.gmailService.getEmail(userId, message.id);
            
            // Extract relevant information
            const headers = email.payload.headers;
            const fromHeader = headers.find(h => h.name === 'From');
            const subjectHeader = headers.find(h => h.name === 'Subject');
            const dateHeader = headers.find(h => h.name === 'Date');
            const toHeader = headers.find(h => h.name === 'To');
            const ccHeader = headers.find(h => h.name === 'Cc');
            const bccHeader = headers.find(h => h.name === 'Bcc');

            // Parse sender information
            let fromAddress = '';
            let name = '';
            let emailAddr = '';

            if (fromHeader && fromHeader.value) {
              const fromMatch = fromHeader.value.match(/^(?:"?([^"]+)"?\s)?<?([^>]+)>?$/);
              if (fromMatch) {
                name = fromMatch[1] || '';
                emailAddr = fromMatch[2] || fromHeader.value;
                fromAddress = fromHeader.value;
              } else {
                emailAddr = fromHeader.value;
                fromAddress = fromHeader.value;
              }
            }

            // Extract email body
            let emailBody = '';
            let htmlBody = '';

            const extractBody = (payload) => {
              if (payload.body && payload.body.data) {
                const bodyData = Buffer.from(payload.body.data, 'base64').toString('utf-8');
                if (payload.mimeType === 'text/plain') {
                  emailBody = bodyData;
                } else if (payload.mimeType === 'text/html') {
                  htmlBody = bodyData;
                }
              }

              if (payload.parts) {
                payload.parts.forEach(part => extractBody(part));
              }
            };

            extractBody(email.payload);

            // Extract attachments info
            const attachments = [];
            const extractAttachments = (payload) => {
              if (payload.filename && payload.body && payload.body.attachmentId) {
                attachments.push({
                  filename: payload.filename,
                  mimeType: payload.mimeType,
                  size: payload.body.size,
                  attachmentId: payload.body.attachmentId
                });
              }

              if (payload.parts) {
                payload.parts.forEach(part => extractAttachments(part));
              }
            };

            extractAttachments(email.payload);
            
            // Insert email into database with enhanced data
            await connection.execute(
              `INSERT INTO gmail_emails
               (user_id, message_id, from_address, email, name, subject, date, snippet,
                to_address, cc_address, bcc_address, body_text, body_html,
                attachments_count, attachments_info, processed, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
               ON DUPLICATE KEY UPDATE
               processed = VALUES(processed),
               updated_at = NOW()`,
              [
                userId,
                message.id,
                fromAddress,
                emailAddr,
                name,
                subjectHeader ? subjectHeader.value : '',
                dateHeader ? dateHeader.value : '',
                email.snippet || '',
                toHeader ? toHeader.value : '',
                ccHeader ? ccHeader.value : '',
                bccHeader ? bccHeader.value : '',
                emailBody || '',
                htmlBody || '',
                attachments.length,
                JSON.stringify(attachments),
                false
              ]
            );
            
            // Record that this email triggered this webhook
            await connection.execute(
              `INSERT INTO gmail_webhook_triggers
               (user_id, message_id, webhook_id, created_at)
               VALUES (?, ?, ?, NOW())`,
              [userId, message.id, webhook.id]
            );
            
            // Trigger the webhook with comprehensive email data
            await this.triggerWebhook(webhook, {
              messageId: message.id,
              threadId: email.threadId,
              from: {
                name: name,
                email: emailAddr,
                address: fromAddress
              },
              to: toHeader ? toHeader.value : '',
              cc: ccHeader ? ccHeader.value : '',
              bcc: bccHeader ? bccHeader.value : '',
              subject: subjectHeader ? subjectHeader.value : '',
              date: dateHeader ? dateHeader.value : '',
              snippet: email.snippet || '',
              body: {
                text: emailBody || '',
                html: htmlBody || ''
              },
              attachments: attachments,
              attachmentCount: attachments.length,
              hasAttachments: attachments.length > 0,
              labels: email.labelIds || [],
              internalDate: email.internalDate,
              sizeEstimate: email.sizeEstimate,
              // Include full email data for advanced processing
              rawEmailData: email
            });
            
            console.log(`📥 New email processed for user ${userId}: ${message.id}`);
          } catch (emailError) {
            console.error(`Error processing email ${message.id} for user ${userId}:`, emailError);
          }
        }
      } finally {
        connection.release();
      }
      
      console.log(`✅ Finished processing emails for user ${userId}`);
    } catch (error) {
      console.error(`Error processing new emails for user ${userId}:`, error);
      throw error;
    }
  }

  // Trigger webhook with email data
  async triggerWebhook(webhook, emailData) {
    try {
      console.log(`🚀 Triggering webhook ${webhook.id} for email ${emailData.messageId}`);
      
      // Send POST request to webhook URL with email data
      const response = await axios.post(webhook.url, {
        event: 'gmail_new_email',
        data: emailData,
        webhook: {
          id: webhook.id,
          name: webhook.name,
          trigger_type: webhook.trigger_type,
          workflow_config: webhook.workflow_config
        },
        timestamp: new Date().toISOString()
      }, {
        timeout: 10000, // 10 second timeout
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'AI-Cruitment-Gmail-Webhook'
        }
      });
      
      console.log(`✅ Webhook triggered successfully for email ${emailData.messageId}`, {
        status: response.status,
        statusText: response.statusText
      });
    } catch (error) {
      console.error(`❌ Error triggering webhook ${webhook.id}:`, error.message);
      
      // Log webhook failure for debugging
      const connection = await pool.getConnection();
      try {
        await connection.execute(
          `INSERT INTO webhook_failures
           (webhook_id, error_message, payload, created_at)
           VALUES (?, ?, ?, NOW())`,
          [webhook.id, error.message, JSON.stringify({ emailData })]
        );
      } finally {
        connection.release();
      }
    }
  }

  // Set up Gmail push notifications for a user
  async setupGmailWatch(userId) {
    try {
      console.log(`🔧 Setting up Gmail watch for user ${userId}`);

      // Set up user authentication
      await this.gmailService.setupUserAuth(userId);

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.gmailService.oauth2Client });

      // Set up watch for new messages
      // Note: For this to work, you need to set up Google Cloud Pub/Sub
      // and configure the topic in your Google Cloud Console
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX'],
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`
        }
      });

      // Store watch history in database
      const connection = await pool.getConnection();
      try {
        await connection.execute(
          `INSERT INTO gmail_watch_history
           (user_id, history_id, expiration, status, created_at)
           VALUES (?, ?, ?, 'active', NOW())
           ON DUPLICATE KEY UPDATE
           history_id = VALUES(history_id),
           expiration = VALUES(expiration),
           status = 'active',
           updated_at = NOW()`,
          [userId, watchResponse.data.historyId, watchResponse.data.expiration]
        );
      } finally {
        connection.release();
      }

      console.log(`✅ Gmail watch set up for user ${userId}:`, watchResponse.data);
      return watchResponse.data;
    } catch (error) {
      console.error(`Error setting up Gmail watch for user ${userId}:`, error);
      throw error;
    }
  }

  // Stop Gmail push notifications for a user
  async stopGmailWatch(userId) {
    try {
      console.log(`🛑 Stopping Gmail watch for user ${userId}`);

      // Set up user authentication
      await this.gmailService.setupUserAuth(userId);

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.gmailService.oauth2Client });

      // Stop watching
      await gmail.users.stop({
        userId: 'me'
      });

      // Update watch history in database
      const connection = await pool.getConnection();
      try {
        await connection.execute(
          `UPDATE gmail_watch_history
           SET status = 'stopped', updated_at = NOW()
           WHERE user_id = ? AND status = 'active'`,
          [userId]
        );
      } finally {
        connection.release();
      }

      console.log(`✅ Gmail watch stopped for user ${userId}`);
    } catch (error) {
      console.error(`Error stopping Gmail watch for user ${userId}:`, error);
      throw error;
    }
  }

  // Get Gmail watch status for a user (enhanced from gmail-code reference)
  async getGmailWatchStatus(userId) {
    try {
      console.log(`🔍 Getting enhanced Gmail watch status for user ${userId}`);

      const connection = await pool.getConnection();
      try {
        // Get watch history
        const [watchRows] = await connection.execute(
          `SELECT * FROM gmail_watch_history
           WHERE user_id = ?
           ORDER BY created_at DESC
           LIMIT 1`,
          [userId]
        );

        // Get active Gmail webhooks for this user
        const [webhooks] = await connection.execute(
          `SELECT w.id, w.name, w.url, w.is_active, w.workflow_config, w.created_at, w.updated_at
           FROM webhooks w
           WHERE w.user_id = ? AND w.trigger_type = 'gmail'
           ORDER BY w.created_at DESC`,
          [userId]
        );

        // Get recent Gmail webhook triggers with enhanced information
        const [recentTriggers] = await connection.execute(
          `SELECT gwt.id, gwt.message_id, gwt.webhook_id, gwt.email_subject, gwt.email_from,
                  gwt.email_to, gwt.attachments_count, gwt.created_at, w.name as webhook_name
           FROM gmail_webhook_triggers gwt
           JOIN webhooks w ON gwt.webhook_id = w.id
           WHERE gwt.user_id = ? AND w.trigger_type = 'gmail'
           ORDER BY gwt.created_at DESC
           LIMIT 10`,
          [userId]
        );

        // Get Gmail connection status and user info
        const isConnected = await this.gmailService.isGmailConnected(userId);
        let userGmailInfo = null;

        if (isConnected) {
          try {
            // Get user Gmail profile information
            const userEmails = await this.gmailService.listUserEmails(userId);
            const labels = await this.gmailService.listGmailLabels(userId);

            userGmailInfo = {
              primaryEmail: userEmails.find(e => e.isPrimary)?.value || userEmails[0]?.value,
              totalLabels: labels.length,
              availableLabels: labels.slice(0, 5).map(l => ({ id: l.value, name: l.name })) // Top 5 labels
            };
          } catch (error) {
            console.warn('Could not fetch Gmail user info:', error.message);
          }
        }

        // Enhanced webhook analysis (from gmail-code reference)
        const webhookAnalysis = webhooks.map(webhook => {
          const config = webhook.workflow_config || {};
          const triggerConfig = config.trigger || {};

          return {
            id: webhook.id,
            name: webhook.name,
            url: webhook.url,
            isActive: webhook.is_active === 1,
            triggerType: triggerConfig.event || 'new-emails',
            labelFilter: triggerConfig.labelId || triggerConfig.labelName || 'All',
            pollInterval: triggerConfig.pollInterval || 15,
            filters: {
              hasAttachment: triggerConfig.filters?.hasAttachment || false,
              fromSender: triggerConfig.filters?.fromSender || null,
              subjectKeyword: triggerConfig.filters?.subjectKeyword || null,
              isImportant: triggerConfig.filters?.isImportant || false,
              isStarred: triggerConfig.filters?.isStarred || false
            },
            createdAt: webhook.created_at,
            updatedAt: webhook.updated_at
          };
        });

        // Watch status analysis
        let watchStatus = { status: 'not_configured', active: false };
        if (watchRows.length > 0) {
          const watchData = watchRows[0];
          const now = Date.now();
          const isExpired = watchData.expiration && now > parseInt(watchData.expiration);

          watchStatus = {
            status: isExpired ? 'expired' : watchData.status,
            active: watchData.status === 'active' && !isExpired,
            historyId: watchData.history_id,
            expiration: watchData.expiration,
            created_at: watchData.created_at,
            updated_at: watchData.updated_at
          };
        }

        return {
          isConnected,
          userGmailInfo,
          watchStatus,
          webhooks: webhookAnalysis,
          recentTriggers: recentTriggers.map(trigger => ({
            id: trigger.id,
            messageId: trigger.message_id,
            webhookId: trigger.webhook_id,
            webhookName: trigger.webhook_name,
            emailSubject: trigger.email_subject,
            emailFrom: trigger.email_from,
            emailTo: trigger.email_to,
            attachmentsCount: trigger.attachments_count || 0,
            createdAt: trigger.created_at
          })),
          statistics: {
            totalWebhooks: webhooks.length,
            activeWebhooks: webhooks.filter(w => w.is_active === 1).length,
            totalTriggers: recentTriggers.length,
            triggersLast24h: recentTriggers.filter(t =>
              new Date(t.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
            ).length
          }
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error(`Error getting Gmail watch status for user ${userId}:`, error);
      throw error;
    }
  }
}

module.exports = new GmailWebhookController();