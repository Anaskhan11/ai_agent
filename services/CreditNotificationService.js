/**
 * Credit Notification Service
 * Handles notifications for credit expiration events
 */

const pool = require('../config/DBConnection');
const CreditExpirationModel = require('../model/CreditModel/CreditExpirationModel');
const { v4: uuidv4 } = require('uuid');

class CreditNotificationService {

  /**
   * Create credit alert record
   */
  static async createCreditAlert(alertData) {
    try {
      const {
        user_id,
        alert_type,
        threshold_value = null,
        current_value = null,
        message,
        metadata = {}
      } = alertData;

      const alert_id = uuidv4();

      const sql = `
        INSERT INTO credit_alerts (
          alert_id, user_id, alert_type, threshold_value, current_value, 
          message, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
      `;

      await pool.execute(sql, [
        alert_id,
        user_id,
        alert_type,
        threshold_value,
        current_value,
        message,
        JSON.stringify(metadata)
      ]);

      return { alert_id, created: true };

    } catch (error) {
      console.error('Error creating credit alert:', error);
      throw error;
    }
  }

  /**
   * Send expiration warning notifications (7 days before expiry)
   */
  static async sendExpirationWarnings() {
    try {
      console.log('📧 Checking for credits expiring in 7 days...');

      const usersWithExpiringCredits = await CreditExpirationModel.getUsersWithExpiringCredits(7);

      if (usersWithExpiringCredits.length === 0) {
        console.log('ℹ️  No users have credits expiring in the next 7 days');
        return { warnings_sent: 0, users: [] };
      }

      const warningsSent = [];

      for (const user of usersWithExpiringCredits) {
        try {
          // Check if we already sent a warning for this user recently
          const recentAlert = await this.checkRecentAlert(user.user_id, 'credits_expiring', 24); // 24 hours
          
          if (recentAlert) {
            console.log(`⏭️  Skipping user ${user.email} - warning already sent recently`);
            continue;
          }

          // Create alert record
          const alertResult = await this.createCreditAlert({
            user_id: user.user_id,
            alert_type: 'credits_expiring',
            threshold_value: 7, // 7 days warning
            current_value: user.expiring_credits,
            message: `You have ${user.expiring_credits} credits expiring on ${new Date(user.earliest_expiry).toLocaleDateString()}. Purchase more credits to avoid service interruption.`,
            metadata: {
              expiring_credits: user.expiring_credits,
              earliest_expiry: user.earliest_expiry,
              expiring_batches: user.expiring_batches,
              warning_type: 'expiration_warning'
            }
          });

          // In a full implementation, you would also:
          // 1. Send email notification
          // 2. Create in-app notification
          // 3. Send push notification (if enabled)

          console.log(`⚠️  Warning created for ${user.email}: ${user.expiring_credits} credits expiring`);
          warningsSent.push({
            user_id: user.user_id,
            email: user.email,
            expiring_credits: user.expiring_credits,
            alert_id: alertResult.alert_id
          });

        } catch (userError) {
          console.error(`Error sending warning to user ${user.email}:`, userError);
        }
      }

      return {
        warnings_sent: warningsSent.length,
        users: warningsSent
      };

    } catch (error) {
      console.error('Error sending expiration warnings:', error);
      throw error;
    }
  }

  /**
   * Send expiration notifications (when credits have expired)
   */
  static async sendExpirationNotifications(expiredBatchIds = []) {
    try {
      console.log('📧 Sending expiration notifications...');

      if (expiredBatchIds.length === 0) {
        console.log('ℹ️  No expired batches to notify about');
        return { notifications_sent: 0, users: [] };
      }

      // Get users affected by expired batches
      const sql = `
        SELECT 
          cb.user_id,
          u.email,
          u.first_name,
          u.last_name,
          SUM(cb.credits_remaining) as expired_credits,
          COUNT(cb.id) as expired_batches
        FROM credit_batches cb
        JOIN users u ON cb.user_id = u.id
        WHERE cb.batch_id IN (${expiredBatchIds.map(() => '?').join(',')})
        GROUP BY cb.user_id, u.email, u.first_name, u.last_name
      `;

      const [affectedUsers] = await pool.execute(sql, expiredBatchIds);

      if (affectedUsers.length === 0) {
        console.log('ℹ️  No users affected by expired batches');
        return { notifications_sent: 0, users: [] };
      }

      const notificationsSent = [];

      for (const user of affectedUsers) {
        try {
          // Create alert record
          const alertResult = await this.createCreditAlert({
            user_id: user.user_id,
            alert_type: 'credits_expired',
            current_value: user.expired_credits,
            message: `${user.expired_credits} of your credits have expired. Purchase new credits to continue using the service.`,
            metadata: {
              expired_credits: user.expired_credits,
              expired_batches: user.expired_batches,
              expiry_date: new Date().toISOString(),
              notification_type: 'expiration_notification'
            }
          });

          console.log(`💸 Expiration notification created for ${user.email}: ${user.expired_credits} credits expired`);
          notificationsSent.push({
            user_id: user.user_id,
            email: user.email,
            expired_credits: user.expired_credits,
            alert_id: alertResult.alert_id
          });

        } catch (userError) {
          console.error(`Error sending expiration notification to user ${user.email}:`, userError);
        }
      }

      return {
        notifications_sent: notificationsSent.length,
        users: notificationsSent
      };

    } catch (error) {
      console.error('Error sending expiration notifications:', error);
      throw error;
    }
  }

  /**
   * Check if user has received a recent alert of the same type
   */
  static async checkRecentAlert(userId, alertType, hoursAgo = 24) {
    try {
      const sql = `
        SELECT id 
        FROM credit_alerts 
        WHERE user_id = ? 
        AND alert_type = ? 
        AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
        LIMIT 1
      `;

      const [rows] = await pool.execute(sql, [userId, alertType, hoursAgo]);
      return rows.length > 0;

    } catch (error) {
      console.error('Error checking recent alerts:', error);
      return false;
    }
  }

  /**
   * Get user's credit alerts
   */
  static async getUserAlerts(userId, limit = 10, alertType = null) {
    try {
      let sql = `
        SELECT 
          alert_id, alert_type, threshold_value, current_value, 
          message, is_sent, sent_at, created_at, metadata
        FROM credit_alerts 
        WHERE user_id = ?
      `;
      
      const params = [userId];

      if (alertType) {
        sql += ' AND alert_type = ?';
        params.push(alertType);
      }

      sql += ' ORDER BY created_at DESC LIMIT ?';
      params.push(limit);

      const [rows] = await pool.execute(sql, params);
      
      return rows.map(row => ({
        ...row,
        metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata || '{}') : row.metadata
      }));

    } catch (error) {
      console.error('Error getting user alerts:', error);
      throw error;
    }
  }

  /**
   * Mark alert as sent
   */
  static async markAlertAsSent(alertId, sentChannels = {}) {
    try {
      const { email = false, push = false } = sentChannels;

      const sql = `
        UPDATE credit_alerts 
        SET is_sent = TRUE, sent_at = NOW(), email_sent = ?, push_sent = ?
        WHERE alert_id = ?
      `;

      await pool.execute(sql, [email, push, alertId]);
      return true;

    } catch (error) {
      console.error('Error marking alert as sent:', error);
      throw error;
    }
  }

  /**
   * Clean up old alerts (older than specified days)
   */
  static async cleanupOldAlerts(daysToKeep = 90) {
    try {
      const sql = `
        DELETE FROM credit_alerts 
        WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      `;

      const [result] = await pool.execute(sql, [daysToKeep]);
      
      console.log(`🧹 Cleaned up ${result.affectedRows} old credit alerts`);
      return result.affectedRows;

    } catch (error) {
      console.error('Error cleaning up old alerts:', error);
      throw error;
    }
  }
}

module.exports = CreditNotificationService;
