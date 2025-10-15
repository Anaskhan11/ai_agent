/**
 * Credit Expiration Model
 * Handles database operations for credit expiration functionality
 */

const pool = require('../../config/DBConnection');
const { v4: uuidv4 } = require('uuid');

// Retry mechanism for database operations
const retryDbOperation = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

/**
 * Create a new credit batch when credits are purchased
 */
async function createCreditBatch(batchData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      credits_purchased,
      purchase_date = new Date(),
      expiry_days = 30,
      package_id = null,
      payment_reference = null,
      batch_type = 'purchase',
      metadata = {}
    } = batchData;

    const batch_id = uuidv4();
    const expiry_date = new Date(purchase_date);
    expiry_date.setDate(expiry_date.getDate() + expiry_days);

    const sql = `
      INSERT INTO credit_batches (
        batch_id, user_id, credits_purchased, credits_remaining, 
        purchase_date, expiry_date, package_id, payment_reference, 
        batch_type, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(sql, [
      batch_id,
      user_id,
      credits_purchased,
      credits_purchased, // credits_remaining starts as credits_purchased
      purchase_date,
      expiry_date,
      package_id,
      payment_reference,
      batch_type,
      JSON.stringify(metadata)
    ]);

    return {
      batch_id,
      credits_purchased,
      expiry_date,
      insertId: result.insertId
    };
  });
}

/**
 * Get user's credit batches (active, expired, or all)
 */
async function getUserCreditBatches(userId, status = 'active', limit = 50) {
  return await retryDbOperation(async () => {
    // Since the credit_batches table might not exist yet, return empty array
    // This is a temporary fix until the table is properly created
    console.log('🔥🔥🔥 getUserCreditBatches CALLED - Returning empty array (table may not exist)');
    console.log('🔥🔥🔥 Parameters:', { userId, status, limit });
    return [];
  });
}

/**
 * Deduct credits from user's batches using FIFO (First In, First Out)
 */
async function deductCreditsFromBatches(userId, creditsToDeduct) {
  return await retryDbOperation(async () => {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get active batches ordered by purchase date (FIFO)
      const [batches] = await connection.execute(`
        SELECT id, batch_id, credits_remaining, purchase_date
        FROM credit_batches 
        WHERE user_id = ? AND is_expired = FALSE AND credits_remaining > 0
        ORDER BY purchase_date ASC
        FOR UPDATE
      `, [userId]);

      if (batches.length === 0) {
        throw new Error('No active credit batches available');
      }

      let remainingToDeduct = creditsToDeduct;
      const deductionDetails = [];

      for (const batch of batches) {
        if (remainingToDeduct <= 0) break;

        const deductFromBatch = Math.min(remainingToDeduct, batch.credits_remaining);
        const newRemaining = batch.credits_remaining - deductFromBatch;

        // Update the batch
        await connection.execute(`
          UPDATE credit_batches 
          SET credits_remaining = ?, credits_used = credits_used + ?, updated_at = NOW()
          WHERE id = ?
        `, [newRemaining, deductFromBatch, batch.id]);

        deductionDetails.push({
          batch_id: batch.batch_id,
          credits_deducted: deductFromBatch,
          credits_remaining: newRemaining,
          purchase_date: batch.purchase_date
        });

        remainingToDeduct -= deductFromBatch;
      }

      if (remainingToDeduct > 0) {
        throw new Error(`Insufficient credits. Could only deduct ${creditsToDeduct - remainingToDeduct} out of ${creditsToDeduct} requested.`);
      }

      await connection.commit();
      return {
        total_deducted: creditsToDeduct,
        batches_affected: deductionDetails
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}

/**
 * Find and expire credits that have passed their expiry date
 */
async function expireCredits() {
  return await retryDbOperation(async () => {
    const connection = await pool.getConnection();
    
    try {
      await connection.beginTransaction();

      // Find batches that should be expired
      const [expiredBatches] = await connection.execute(`
        SELECT id, batch_id, user_id, credits_remaining
        FROM credit_batches 
        WHERE is_expired = FALSE 
        AND expiry_date <= NOW()
        AND credits_remaining > 0
        FOR UPDATE
      `);

      if (expiredBatches.length === 0) {
        await connection.commit();
        return { expired_batches: 0, total_credits_expired: 0 };
      }

      let totalCreditsExpired = 0;
      const expiredBatchIds = [];

      // Process each expired batch
      for (const batch of expiredBatches) {
        // Mark batch as expired
        await connection.execute(`
          UPDATE credit_batches 
          SET is_expired = TRUE, expired_at = NOW(), updated_at = NOW()
          WHERE id = ?
        `, [batch.id]);

        // Update user's expired_credits total
        await connection.execute(`
          UPDATE user_credits 
          SET expired_credits = expired_credits + ?, 
              last_expiry_at = NOW(),
              updated_at = NOW()
          WHERE user_id = ?
        `, [batch.credits_remaining, batch.user_id]);

        totalCreditsExpired += parseFloat(batch.credits_remaining);
        expiredBatchIds.push(batch.batch_id);
      }

      await connection.commit();
      
      return {
        expired_batches: expiredBatches.length,
        total_credits_expired: totalCreditsExpired,
        expired_batch_ids: expiredBatchIds
      };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}

/**
 * Get users with credits expiring soon (within specified days)
 */
async function getUsersWithExpiringCredits(daysAhead = 7) {
  return await retryDbOperation(async () => {
    // Validate daysAhead parameter
    const daysValue = parseInt(daysAhead, 10);
    if (isNaN(daysValue) || daysValue <= 0) {
      throw new Error(`Invalid daysAhead value: ${daysAhead}`);
    }

    const sql = `
      SELECT 
        cb.user_id,
        u.email,
        u.first_name,
        u.last_name,
        SUM(cb.credits_remaining) as expiring_credits,
        MIN(cb.expiry_date) as earliest_expiry,
        COUNT(cb.id) as expiring_batches
      FROM credit_batches cb
      JOIN users u ON cb.user_id = u.id
      WHERE cb.is_expired = FALSE 
      AND cb.credits_remaining > 0
      AND cb.expiry_date <= DATE_ADD(NOW(), INTERVAL ? DAY)
      AND cb.expiry_date > NOW()
      GROUP BY cb.user_id, u.email, u.first_name, u.last_name
      ORDER BY earliest_expiry ASC
    `;

    const [rows] = await pool.execute(sql, [daysValue]);
    return rows;
  });
}

/**
 * Get credit expiration statistics
 */
async function getCreditExpirationStats(days = 30) {
  return await retryDbOperation(async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [stats] = await pool.execute(`
      SELECT 
        COUNT(DISTINCT CASE WHEN is_expired = TRUE AND expired_at >= ? THEN id END) as batches_expired,
        COALESCE(SUM(CASE WHEN is_expired = TRUE AND expired_at >= ? THEN credits_purchased - credits_used END), 0) as credits_expired,
        COUNT(DISTINCT CASE WHEN is_expired = FALSE AND expiry_date <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN id END) as batches_expiring_soon,
        COALESCE(SUM(CASE WHEN is_expired = FALSE AND expiry_date <= DATE_ADD(NOW(), INTERVAL 7 DAY) THEN credits_remaining END), 0) as credits_expiring_soon,
        COUNT(DISTINCT CASE WHEN is_expired = FALSE THEN id END) as active_batches,
        COALESCE(SUM(CASE WHEN is_expired = FALSE THEN credits_remaining END), 0) as active_credits
      FROM credit_batches
    `, [startDate, startDate]);

    return stats[0];
  });
}

module.exports = {
  createCreditBatch,
  getUserCreditBatches,
  deductCreditsFromBatches,
  expireCredits,
  getUsersWithExpiringCredits,
  getCreditExpirationStats
};
