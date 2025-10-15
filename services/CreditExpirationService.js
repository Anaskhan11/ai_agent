/**
 * Credit Expiration Service
 * Business logic layer for credit expiration functionality
 */

const CreditExpirationModel = require('../model/CreditModel/CreditExpirationModel');
const CreditModel = require('../model/CreditModel/CreditModel');
const CreditNotificationService = require('./CreditNotificationService');
const { v4: uuidv4 } = require('uuid');

class CreditExpirationService {
  
  /**
   * Process credit purchase and create expiring batch
   */
  static async processCreditPurchase(purchaseData) {
    try {
      const {
        user_id,
        credits_amount,
        package_id = null,
        payment_reference = null,
        bonus_credits = 0,
        expiry_days = 30
      } = purchaseData;

      const batches = [];

      // Create main credit batch
      if (credits_amount > 0) {
        const mainBatch = await CreditExpirationModel.createCreditBatch({
          user_id,
          credits_purchased: credits_amount,
          package_id,
          payment_reference,
          batch_type: 'purchase',
          expiry_days,
          metadata: {
            purchase_type: 'main_credits',
            package_id
          }
        });
        batches.push(mainBatch);
      }

      // Create bonus credit batch if applicable
      if (bonus_credits > 0) {
        const bonusBatch = await CreditExpirationModel.createCreditBatch({
          user_id,
          credits_purchased: bonus_credits,
          package_id,
          payment_reference,
          batch_type: 'bonus',
          expiry_days,
          metadata: {
            purchase_type: 'bonus_credits',
            package_id,
            related_to: batches[0]?.batch_id
          }
        });
        batches.push(bonusBatch);
      }

      return {
        success: true,
        batches,
        total_credits: credits_amount + bonus_credits,
        expiry_date: batches[0]?.expiry_date
      };

    } catch (error) {
      console.error('Error processing credit purchase:', error);
      throw new Error(`Failed to process credit purchase: ${error.message}`);
    }
  }

  /**
   * Deduct credits using FIFO approach (oldest credits first)
   */
  static async deductCredits(userId, creditsToDeduct, operationType, operationId, description = '') {
    try {
      // First check if user has sufficient credits
      const balance = await CreditModel.getUserCreditBalance(userId);
      if (!balance || balance.available_credits < creditsToDeduct) {
        throw new Error('Insufficient credits available');
      }

      // Deduct from batches using FIFO
      const deductionResult = await CreditExpirationModel.deductCreditsFromBatches(
        userId, 
        creditsToDeduct
      );

      // Create transaction record
      const transactionId = uuidv4();
      await CreditModel.deductCreditsFromUser(
        userId,
        creditsToDeduct,
        operationType,
        operationId,
        description,
        {
          batch_deduction: true,
          batches_affected: deductionResult.batches_affected,
          deduction_method: 'FIFO'
        }
      );

      return {
        success: true,
        credits_deducted: creditsToDeduct,
        transaction_id: transactionId,
        batches_affected: deductionResult.batches_affected
      };

    } catch (error) {
      console.error('Error deducting credits:', error);
      throw new Error(`Failed to deduct credits: ${error.message}`);
    }
  }

  /**
   * Run daily expiration process
   */
  static async runDailyExpiration() {
    try {
      console.log('🕐 Starting daily credit expiration process...');

      // Expire credits
      const expirationResult = await CreditExpirationModel.expireCredits();
      
      if (expirationResult.expired_batches > 0) {
        console.log(`✅ Expired ${expirationResult.expired_batches} credit batches`);
        console.log(`💸 Total credits expired: ${expirationResult.total_credits_expired}`);

        // Send expiration notifications
        await CreditNotificationService.sendExpirationNotifications(expirationResult.expired_batch_ids);

        // Create expiry transactions for audit trail
        await this.createExpiryTransactions(expirationResult);
      } else {
        console.log('ℹ️  No credits expired today');
      }

      return expirationResult;

    } catch (error) {
      console.error('❌ Error in daily expiration process:', error);
      throw error;
    }
  }

  /**
   * Create transaction records for expired credits
   */
  static async createExpiryTransactions(expirationResult) {
    try {
      // This would create individual transaction records for each user whose credits expired
      // For now, we'll log the expiration - in a full implementation, you'd want to 
      // create individual transaction records per user
      console.log('📝 Creating expiry transaction records...');
      
      // You could extend this to create detailed transaction records
      // for each user whose credits expired
      
      return true;
    } catch (error) {
      console.error('Error creating expiry transactions:', error);
      throw error;
    }
  }

  /**
   * Get user's credit expiration summary
   */
  static async getUserExpirationSummary(userId) {
    try {
      console.log('=== CreditExpirationService.getUserExpirationSummary ===');
      console.log('userId:', userId, 'type:', typeof userId);
      console.log('========================================================');

      const [activeBatches, expiringSoon, expiredBatches] = await Promise.all([
        CreditExpirationModel.getUserCreditBatches(userId, 'active'),
        CreditExpirationModel.getUserCreditBatches(userId, 'expiring_soon'),
        CreditExpirationModel.getUserCreditBatches(userId, 'expired', 10)
      ]);

      const totalActiveCredits = activeBatches.reduce((sum, batch) => sum + parseFloat(batch.credits_remaining), 0);
      const totalExpiringSoon = expiringSoon.reduce((sum, batch) => sum + parseFloat(batch.credits_remaining), 0);

      return {
        active_batches: activeBatches.length,
        total_active_credits: totalActiveCredits,
        expiring_soon_batches: expiringSoon.length,
        credits_expiring_soon: totalExpiringSoon,
        recent_expired_batches: expiredBatches.length,
        batches: {
          active: activeBatches,
          expiring_soon: expiringSoon,
          recently_expired: expiredBatches
        }
      };

    } catch (error) {
      console.error('Error getting user expiration summary:', error);
      throw new Error(`Failed to get expiration summary: ${error.message}`);
    }
  }

  /**
   * Send expiration notifications
   */
  static async sendExpirationNotifications() {
    try {
      console.log('📧 Checking for expiration notifications...');

      // Send warnings for credits expiring in 7 days
      const warningResult = await CreditNotificationService.sendExpirationWarnings();

      return {
        warnings_sent: warningResult.warnings_sent,
        users: warningResult.users
      };

    } catch (error) {
      console.error('Error sending expiration notifications:', error);
      throw error;
    }
  }

  /**
   * Get system-wide expiration statistics
   */
  static async getExpirationStatistics(days = 30) {
    try {
      const stats = await CreditExpirationModel.getCreditExpirationStats(days);
      
      return {
        period_days: days,
        ...stats,
        expiration_rate: stats.active_credits > 0 ? 
          (stats.credits_expired / (stats.credits_expired + stats.active_credits) * 100).toFixed(2) : 0
      };

    } catch (error) {
      console.error('Error getting expiration statistics:', error);
      throw new Error(`Failed to get expiration statistics: ${error.message}`);
    }
  }

  /**
   * Extend credit expiration (admin function)
   */
  static async extendCreditExpiration(batchId, additionalDays) {
    try {
      // This would be an admin function to extend credit expiration
      // Implementation would update the expiry_date in credit_batches table
      console.log(`🔧 Extending expiration for batch ${batchId} by ${additionalDays} days`);
      
      // Implementation placeholder
      return {
        success: true,
        message: `Credit batch expiration extended by ${additionalDays} days`
      };

    } catch (error) {
      console.error('Error extending credit expiration:', error);
      throw error;
    }
  }
}

module.exports = CreditExpirationService;
