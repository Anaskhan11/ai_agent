const EmailService = require('./EmailService');
const GmailService = require('./GmailService');
const pool = require('../config/DBConnection');
require('dotenv').config();

class WebhookGmailNotificationService {
  constructor() {
    this.emailService = EmailService;
    this.gmailService = new GmailService();
  }

  /**
   * Send webhook data to all connected Gmail accounts
   * @param {Object} webhookData - The captured webhook data
   * @param {Object} webhookConfig - The webhook configuration
   * @param {string} webhookId - The webhook ID
   */
  async sendWebhookDataToConnectedGmails(webhookData, webhookConfig, webhookId) {
    try {
      console.log(`📧 Processing Gmail notifications for webhook ${webhookId}`);

      // Get all users with connected Gmail accounts
      const connectedUsers = await this.getConnectedGmailUsers();
      
      if (connectedUsers.length === 0) {
        console.log('ℹ️ No users with connected Gmail accounts found');
        return;
      }

      console.log(`📧 Found ${connectedUsers.length} users with connected Gmail accounts`);

      // Send notifications to each connected user
      const results = [];
      for (const user of connectedUsers) {
        try {
          const result = await this.sendNotificationToUser(user, webhookData, webhookConfig, webhookId);
          results.push({
            userId: user.id,
            email: user.gmailAddress || user.email, // Use the actual Gmail address
            success: result.success,
            messageId: result.messageId,
            provider: result.provider,
            error: result.error
          });
        } catch (error) {
          console.error(`❌ Error sending notification to user ${user.id}:`, error);
          results.push({
            userId: user.id,
            email: user.email,
            success: false,
            error: error.message
          });
        }
      }

      // Log the results
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.length - successCount;
      
      console.log(`📧 Gmail notification summary: ${successCount} successful, ${failureCount} failed`);

      // Store notification results in database
      await this.storeNotificationResults(webhookId, results);

      return results;

    } catch (error) {
      console.error('❌ Error in sendWebhookDataToConnectedGmails:', error);
      throw error;
    }
  }

  /**
   * Get all users with connected Gmail accounts
   */
  async getConnectedGmailUsers() {
    const connection = await pool.getConnection();
    try {
      // Get users who have Gmail tokens (connected Gmail accounts)
      const [users] = await connection.execute(
        `SELECT DISTINCT u.id, u.email, u.first_name, u.last_name, gt.access_token, gt.refresh_token
         FROM users u
         INNER JOIN gmail_tokens gt ON u.id = gt.user_id
         WHERE gt.access_token IS NOT NULL
         AND gt.refresh_token IS NOT NULL
         AND u.is_active = 1`
      );

      console.log(`🔍 Found ${users.length} users with connected Gmail accounts`);
      
      // Get the actual Gmail account for each user
      const usersWithGmail = [];
      for (const user of users) {
        try {
          // Set up Gmail service for this user
          await this.gmailService.setupUserAuth(user.id);
          
          // Get the Gmail profile to get the actual Gmail address
          const profile = await this.gmailService.getUserProfile(user.id);
          
          usersWithGmail.push({
            ...user,
            gmailAddress: profile.emailAddress // Use the actual connected Gmail address
          });
          
          console.log(`📧 User ${user.id} (${user.email}) has connected Gmail: ${profile.emailAddress}`);
        } catch (error) {
          console.error(`❌ Error getting Gmail profile for user ${user.id}:`, error.message);
          // Still include the user but with their database email as fallback
          usersWithGmail.push({
            ...user,
            gmailAddress: user.email
          });
        }
      }
      
      return usersWithGmail;

    } finally {
      connection.release();
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendNotificationToUser(user, webhookData, webhookConfig, webhookId) {
    try {
      // Use the actual connected Gmail address if available, otherwise fall back to user email
      const recipientEmail = user.gmailAddress || user.email;
      console.log(`📧 Sending notification to user ${user.id} (${user.email}) at Gmail: ${recipientEmail}`);

      // Prepare email content
      const emailContent = this.prepareEmailContent(user, webhookData, webhookConfig, webhookId);

      // Send email using server SMTP
      const result = await this.emailService.sendCustomEmail(
        recipientEmail,
        emailContent.subject,
        emailContent.htmlBody,
        `${process.env.APP_NAME || 'AI CRUITMENT'} - Webhook Notification`
      );

      if (result.success) {
        console.log(`✅ Notification sent to ${recipientEmail} via ${result.provider}`);
      } else {
        console.log(`❌ Failed to send notification to ${recipientEmail}: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ Error sending notification to user ${user.id}:`, error);
      throw error;
    }
  }

  /**
   * Prepare email content for webhook notification
   */
  prepareEmailContent(user, webhookData, webhookConfig, webhookId) {
    const webhookName = webhookConfig.name || 'Unknown Webhook';
    const timestamp = new Date().toLocaleString();
    
    // Extract key information from webhook data
    const contactInfo = this.extractContactInfo(webhookData);
    
    const subject = `🔔 New Webhook Data: ${webhookName} - ${contactInfo.name || contactInfo.email || 'New Submission'}`;
    
    const htmlBody = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Webhook Notification</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9f9f9;
          }
          .container {
            background: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          .webhook-info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #007bff;
          }
          .contact-info {
            background: #e8f5e8;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #28a745;
          }
          .data-section {
            background: #fff3cd;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            border-left: 4px solid #ffc107;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            color: #666;
            font-size: 14px;
          }
          .label {
            font-weight: bold;
            color: #495057;
          }
          .value {
            color: #212529;
          }
          .timestamp {
            color: #6c757d;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔔 Webhook Notification</h1>
            <p>New data received from your webhook</p>
          </div>
          
          <div class="webhook-info">
            <h3>📋 Webhook Information</h3>
            <p><span class="label">Webhook Name:</span> <span class="value">${webhookName}</span></p>
            <p><span class="label">Webhook ID:</span> <span class="value">${webhookId}</span></p>
            <p><span class="label">Received:</span> <span class="value">${timestamp}</span></p>
          </div>
          
          ${contactInfo.name || contactInfo.email ? `
          <div class="contact-info">
            <h3>👤 Contact Information</h3>
            ${contactInfo.name ? `<p><span class="label">Name:</span> <span class="value">${contactInfo.name}</span></p>` : ''}
            ${contactInfo.email ? `<p><span class="label">Email:</span> <span class="value">${contactInfo.email}</span></p>` : ''}
            ${contactInfo.phone ? `<p><span class="label">Phone:</span> <span class="value">${contactInfo.phone}</span></p>` : ''}
            ${contactInfo.company ? `<p><span class="label">Company:</span> <span class="value">${contactInfo.company}</span></p>` : ''}
          </div>
          ` : ''}
          
          <div class="data-section">
            <h3>📊 Webhook Data</h3>
            <pre style="background: #f8f9fa; padding: 10px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap;">${JSON.stringify(webhookData, null, 2)}</pre>
          </div>
          
          <div class="footer">
            <p>This notification was sent automatically by ${process.env.APP_NAME || 'AI CRUITMENT'}</p>
            <p class="timestamp">Notification sent at: ${new Date().toISOString()}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return { subject, htmlBody };
  }

  /**
   * Extract contact information from webhook data
   */
  extractContactInfo(webhookData) {
    const contactInfo = {};

    // Common field mappings
    const fieldMappings = {
      name: ['name', 'Name', 'NAME', 'full_name', 'fullName', 'first_name', 'firstName'],
      email: ['email', 'Email', 'EMAIL', 'user_email', 'contact_email'],
      phone: ['phone', 'Phone', 'PHONE', 'phone_number', 'phoneNumber'],
      company: ['company', 'Company', 'COMPANY', 'organization']
    };

    // Extract data using field mappings
    Object.keys(fieldMappings).forEach(field => {
      const possibleKeys = fieldMappings[field];
      for (const key of possibleKeys) {
        if (webhookData[key]) {
          contactInfo[field] = webhookData[key];
          break;
        }
      }
    });

    return contactInfo;
  }

  /**
   * Store notification results in database
   */
  async storeNotificationResults(webhookId, results) {
    const connection = await pool.getConnection();
    try {
      for (const result of results) {
        await connection.execute(
          `INSERT INTO webhook_notification_logs
           (webhook_id, user_id, user_email, success, message_id, provider, error_message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            webhookId,
            result.userId,
            result.email, // This will now be the actual Gmail address used
            result.success ? 1 : 0,
            result.messageId || null,
            result.provider || null,
            result.error || null
          ]
        );
      }
      
      console.log(`✅ Stored notification results for webhook ${webhookId}`);
    } finally {
      connection.release();
    }
  }

  /**
   * Get notification history for a webhook
   */
  async getNotificationHistory(webhookId, limit = 50) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM webhook_notification_logs
         WHERE webhook_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [webhookId, parseInt(limit)]
      );

      return rows;
    } finally {
      connection.release();
    }
  }

  /**
   * Test Gmail connection for a user
   */
  async testGmailConnection(userId) {
    try {
      const isConnected = await this.gmailService.isGmailConnected(userId);
      if (isConnected) {
        // Try to get user profile to verify connection is working
        const profile = await this.gmailService.getUserProfile(userId);
        return {
          success: true,
          connected: true,
          email: profile.emailAddress,
          messagesTotal: profile.messagesTotal,
          threadsTotal: profile.threadsTotal
        };
      } else {
        return {
          success: true,
          connected: false,
          message: 'Gmail not connected'
        };
      }
    } catch (error) {
      console.error(`❌ Error testing Gmail connection for user ${userId}:`, error);
      return {
        success: false,
        connected: false,
        error: error.message
      };
    }
  }
}

module.exports = new WebhookGmailNotificationService();
