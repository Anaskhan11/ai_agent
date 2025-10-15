const WebhookGmailNotificationService = require('../services/WebhookGmailNotificationService');
const GmailService = require('../services/GmailService');
const pool = require('../config/DBConnection');
require('dotenv').config();

class GmailNotificationController {
  constructor() {
    this.webhookGmailService = WebhookGmailNotificationService;
    this.gmailService = new GmailService();
  }

  /**
   * Get all users with connected Gmail accounts
   */
  async getConnectedGmailUsers(req, res) {
    try {
      const users = await this.webhookGmailService.getConnectedGmailUsers();
      
      res.status(200).json({
        success: true,
        data: {
          users: users.map(user => ({
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            hasGmailTokens: !!(user.access_token && user.refresh_token)
          })),
          total: users.length
        }
      });
    } catch (error) {
      console.error('Error getting connected Gmail users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get connected Gmail users',
        error: error.message
      });
    }
  }

  /**
   * Test Gmail connection for a specific user
   */
  async testGmailConnection(req, res) {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      const result = await this.webhookGmailService.testGmailConnection(userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('Error testing Gmail connection:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to test Gmail connection',
        error: error.message
      });
    }
  }

  /**
   * Send test notification to connected Gmail accounts
   */
  async sendTestNotification(req, res) {
    try {
      const { webhookId } = req.params;
      const testData = req.body || {
        name: 'Test User',
        email: 'test@example.com',
        phone: '+1234567890',
        message: 'This is a test webhook notification',
        source: 'test_notification',
        timestamp: new Date().toISOString()
      };

      const webhookConfig = {
        name: 'Test Webhook',
        id: webhookId,
        user_id: req.user?.id || 1
      };

      console.log(`🧪 Sending test notification for webhook ${webhookId}`);

      const results = await this.webhookGmailService.sendWebhookDataToConnectedGmails(
        testData,
        webhookConfig,
        webhookId
      );

      res.status(200).json({
        success: true,
        message: 'Test notification sent successfully',
        data: {
          webhookId,
          testData,
          results: results || []
        }
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error.message
      });
    }
  }

  /**
   * Get notification history for a webhook
   */
  async getNotificationHistory(req, res) {
    try {
      const { webhookId } = req.params;
      const { limit = 50 } = req.query;

      if (!webhookId) {
        return res.status(400).json({
          success: false,
          message: 'Webhook ID is required'
        });
      }

      const history = await this.webhookGmailService.getNotificationHistory(webhookId, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          webhookId,
          history,
          total: history.length
        }
      });
    } catch (error) {
      console.error('Error getting notification history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification history',
        error: error.message
      });
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(req, res) {
    try {
      const connection = await pool.getConnection();
      try {
        // Get overall statistics
        const [totalStats] = await connection.execute(
          `SELECT 
            COUNT(*) as total_notifications,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful_notifications,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_notifications
           FROM webhook_notification_logs`
        );

        // Get recent activity (last 7 days)
        const [recentStats] = await connection.execute(
          `SELECT 
            COUNT(*) as recent_notifications,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as recent_successful,
            SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as recent_failed
           FROM webhook_notification_logs
           WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`
        );

        // Get top webhooks by notification count
        const [topWebhooks] = await connection.execute(
          `SELECT 
            webhook_id,
            COUNT(*) as notification_count,
            SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
           FROM webhook_notification_logs
           GROUP BY webhook_id
           ORDER BY notification_count DESC
           LIMIT 10`
        );

        // Get connected Gmail users count
        const [connectedUsers] = await connection.execute(
          `SELECT COUNT(DISTINCT user_id) as connected_users
           FROM gmail_tokens
           WHERE access_token IS NOT NULL AND refresh_token IS NOT NULL`
        );

        res.status(200).json({
          success: true,
          data: {
            overall: totalStats[0],
            recent: recentStats[0],
            topWebhooks,
            connectedUsers: connectedUsers[0].connected_users
          }
        });
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error getting notification stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification statistics',
        error: error.message
      });
    }
  }

  /**
   * Disconnect Gmail for a user
   */
  async disconnectGmail(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      await this.gmailService.disconnectGmail(userId);

      res.status(200).json({
        success: true,
        message: 'Gmail disconnected successfully',
        data: { userId }
      });
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to disconnect Gmail',
        error: error.message
      });
    }
  }

  /**
   * Get Gmail connection status for current user
   */
  async getMyGmailStatus(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const isConnected = await this.gmailService.isGmailConnected(userId);
      
      let profile = null;
      if (isConnected) {
        try {
          profile = await this.gmailService.getUserProfile(userId);
        } catch (error) {
          console.log('Could not get Gmail profile:', error.message);
        }
      }

      res.status(200).json({
        success: true,
        data: {
          connected: isConnected,
          profile: profile ? {
            emailAddress: profile.emailAddress,
            messagesTotal: profile.messagesTotal,
            threadsTotal: profile.threadsTotal
          } : null
        }
      });
    } catch (error) {
      console.error('Error getting Gmail status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get Gmail status',
        error: error.message
      });
    }
  }

  /**
   * Generate Gmail OAuth URL for current user
   */
  async generateGmailAuthUrl(req, res) {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const authUrl = this.gmailService.generateAuthUrl(userId, '/webhooks');

      res.status(200).json({
        success: true,
        data: {
          authUrl,
          userId
        }
      });
    } catch (error) {
      console.error('Error generating Gmail auth URL:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate Gmail auth URL',
        error: error.message
      });
    }
  }
}

module.exports = new GmailNotificationController();
