/**
 * Auto Subscription Model
 * Handles database operations for auto-subscription functionality
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
 * Get user's auto-subscription settings
 */
async function getUserAutoSubscriptionSettings(userId) {
  return await retryDbOperation(async () => {
    const [rows] = await pool.execute(`
      SELECT 
        ass.*,
        cp.name as package_name,
        cp.credits_amount,
        cp.price_cents
      FROM auto_subscription_settings ass
      LEFT JOIN credit_packages cp ON ass.target_package_id = cp.package_id
      WHERE ass.user_id = ?
    `, [userId]);
    
    return rows.length > 0 ? rows[0] : null;
  });
}

/**
 * Create or update user's auto-subscription settings
 */
async function setUserAutoSubscriptionSettings(userId, settings) {
  return await retryDbOperation(async () => {
    const {
      enabled = false,
      target_package_id = 'professional',
      trigger_threshold = 0,
      max_monthly_purchases = 1
    } = settings;

    const [existing] = await pool.execute(
      'SELECT id FROM auto_subscription_settings WHERE user_id = ?',
      [userId]
    );

    if (existing.length > 0) {
      // Update existing settings
      await pool.execute(`
        UPDATE auto_subscription_settings 
        SET enabled = ?, target_package_id = ?, trigger_threshold = ?, 
            max_monthly_purchases = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `, [enabled, target_package_id, trigger_threshold, max_monthly_purchases, userId]);
      
      return { updated: true, userId };
    } else {
      // Create new settings
      await pool.execute(`
        INSERT INTO auto_subscription_settings 
        (user_id, enabled, target_package_id, trigger_threshold, max_monthly_purchases)
        VALUES (?, ?, ?, ?, ?)
      `, [userId, enabled, target_package_id, trigger_threshold, max_monthly_purchases]);
      
      return { created: true, userId };
    }
  });
}

/**
 * Check if user can make auto-purchase (within monthly limits)
 */
async function canUserMakeAutoPurchase(userId) {
  return await retryDbOperation(async () => {
    // Get user's settings
    const settings = await getUserAutoSubscriptionSettings(userId);
    if (!settings || !settings.enabled) {
      return { canPurchase: false, reason: 'Auto-subscription not enabled' };
    }

    // Check monthly purchase limit
    const [monthlyCount] = await pool.execute(`
      SELECT COUNT(*) as count
      FROM auto_subscription_history
      WHERE user_id = ? 
        AND status = 'succeeded'
        AND triggered_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
    `, [userId]);

    if (monthlyCount[0].count >= settings.max_monthly_purchases) {
      return { 
        canPurchase: false, 
        reason: `Monthly limit reached (${settings.max_monthly_purchases})` 
      };
    }

    return { 
      canPurchase: true, 
      settings,
      monthlyPurchases: monthlyCount[0].count 
    };
  });
}

/**
 * Create auto-subscription history record
 */
async function createAutoSubscriptionHistory(historyData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      package_id,
      credits_purchased,
      amount_cents,
      stripe_payment_intent_id = null,
      status = 'pending',
      triggered_by = 'low_credits',
      metadata = {}
    } = historyData;

    const [result] = await pool.execute(`
      INSERT INTO auto_subscription_history 
      (user_id, package_id, credits_purchased, amount_cents, stripe_payment_intent_id, 
       status, triggered_by, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      user_id, package_id, credits_purchased, amount_cents, 
      stripe_payment_intent_id, status, triggered_by, JSON.stringify(metadata)
    ]);

    return {
      id: result.insertId,
      user_id,
      package_id,
      status
    };
  });
}

/**
 * Update auto-subscription history record
 */
async function updateAutoSubscriptionHistory(historyId, updateData) {
  return await retryDbOperation(async () => {
    const allowedFields = [
      'status', 'stripe_payment_intent_id', 'completed_at', 'error_message', 'metadata'
    ];

    const updateFields = [];
    const updateValues = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        if (key === 'metadata') {
          updateValues.push(JSON.stringify(updateData[key]));
        } else {
          updateValues.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateValues.push(historyId);

    await pool.execute(`
      UPDATE auto_subscription_history 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `, updateValues);

    return { updated: true, historyId };
  });
}

/**
 * Get user's auto-subscription history
 */
async function getUserAutoSubscriptionHistory(userId, limit = 10) {
  return await retryDbOperation(async () => {
    const [rows] = await pool.execute(`
      SELECT 
        ash.*,
        cp.name as package_name
      FROM auto_subscription_history ash
      LEFT JOIN credit_packages cp ON ash.package_id = cp.package_id
      WHERE ash.user_id = ?
      ORDER BY ash.triggered_at DESC
      LIMIT ?
    `, [userId, limit]);

    return rows.map(row => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    }));
  });
}

/**
 * Mark user's free trial as claimed
 */
async function markFreeTrialClaimed(userId) {
  return await retryDbOperation(async () => {
    await pool.execute(`
      UPDATE users 
      SET free_trial_claimed = TRUE, free_trial_claimed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [userId]);
    
    return { success: true, userId };
  });
}

/**
 * Store user's Stripe customer and payment method info
 */
async function storeUserPaymentInfo(userId, paymentInfo) {
  return await retryDbOperation(async () => {
    const {
      stripe_customer_id,
      default_payment_method_id
    } = paymentInfo;

    await pool.execute(`
      UPDATE users 
      SET stripe_customer_id = ?, default_payment_method_id = ?
      WHERE id = ?
    `, [stripe_customer_id, default_payment_method_id, userId]);
    
    return { success: true, userId };
  });
}

module.exports = {
  getUserAutoSubscriptionSettings,
  setUserAutoSubscriptionSettings,
  canUserMakeAutoPurchase,
  createAutoSubscriptionHistory,
  updateAutoSubscriptionHistory,
  getUserAutoSubscriptionHistory,
  markFreeTrialClaimed,
  storeUserPaymentInfo
};
