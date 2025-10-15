const pool = require("../../config/DBConnection");
const { v4: uuidv4 } = require('uuid');
const CreditExpirationService = require('../../services/CreditExpirationService');

// Retry mechanism for database operations
const retryDbOperation = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.log(`Database operation failed (attempt ${attempt}/${maxRetries}):`, error.message);
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
};

// Helper function to validate user existence
async function validateUserExists(userId) {
  // Ensure userId is an integer
  const validUserId = parseInt(userId);
  if (isNaN(validUserId) || validUserId <= 0) {
    throw new Error(`Invalid user ID format: ${userId} (must be a positive integer)`);
  }

  const userCheckSql = 'SELECT id, username, email FROM users WHERE id = ?';
  const [userRows] = await pool.execute(userCheckSql, [validUserId]);

  if (userRows.length === 0) {
    throw new Error(`User with ID ${validUserId} does not exist in the users table.`);
  }

  return userRows[0];
}

// Get user credit balance
async function getUserCreditBalance(userId) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        total_credits,
        used_credits,
        expired_credits,
        available_credits,
        last_purchase_at,
        last_usage_at,
        last_expiry_at,
        created_at,
        updated_at
      FROM user_credits
      WHERE user_id = ?
    `;
    const [rows] = await pool.execute(sql, [userId]);
    return rows[0] || null;
  });
}

// Initialize user credits (called when user is created)
async function initializeUserCredits(userId, initialCredits = 0) {
  return await retryDbOperation(async () => {
    // First, verify that the user exists
    const user = await validateUserExists(userId);
    console.log(`✅ Validated user exists: ${user.username} (${user.email})`);

    const sql = `
      INSERT INTO user_credits (user_id, total_credits, used_credits)
      VALUES (?, ?, 0.00)
      ON DUPLICATE KEY UPDATE
      total_credits = total_credits
    `;
    const [result] = await pool.execute(sql, [userId, initialCredits]);
    console.log(`✅ Initialized credits for user ${userId}: ${initialCredits} credits`);
    return result;
  });
}

// Add credits to user account (for purchases, bonuses, adjustments)
async function addCreditsToUser(userId, amount, transactionType = 'purchase', description = '', referenceId = null, packageId = null) {
  return await retryDbOperation(async () => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get current balance
      const [balanceRows] = await connection.execute(
        'SELECT total_credits, used_credits FROM user_credits WHERE user_id = ? FOR UPDATE',
        [userId]
      );

      let currentBalance = 0;
      if (balanceRows.length === 0) {
        // Initialize if doesn't exist
        await connection.execute(
          'INSERT INTO user_credits (user_id, total_credits, used_credits) VALUES (?, 0, 0)',
          [userId]
        );
      } else {
        currentBalance = parseFloat(balanceRows[0].total_credits);
      }

      const newBalance = currentBalance + parseFloat(amount);

      // Update user credits
      await connection.execute(
        `UPDATE user_credits 
         SET total_credits = ?, last_purchase_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [newBalance, userId]
      );

      // Create transaction record
      const transactionId = uuidv4();
      await connection.execute(
        `INSERT INTO credit_transactions 
         (transaction_id, user_id, type, amount, balance_before, balance_after, description, reference_id, package_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [transactionId, userId, transactionType, amount, currentBalance, newBalance, description, referenceId, packageId]
      );

      await connection.commit();
      return {
        transactionId,
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        creditsAdded: amount
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}

// Deduct credits from user account (for usage) - Updated to use FIFO batch system
async function deductCreditsFromUser(userId, amount, operationType, operationId = null, description = '', metadata = {}) {
  return await retryDbOperation(async () => {
    try {
      // Use the new FIFO credit expiration service for deduction
      const deductionResult = await CreditExpirationService.deductCredits(
        userId,
        amount,
        operationType,
        operationId,
        description
      );

      // For backward compatibility, also update the user_credits table
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();

        // Update used credits in user_credits table
        await connection.execute(
          `UPDATE user_credits
           SET used_credits = used_credits + ?, last_usage_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ?`,
          [amount, userId]
        );

        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      return {
        transactionId: deductionResult.transaction_id,
        balanceBefore: null, // Will be calculated by the service
        balanceAfter: null,  // Will be calculated by the service
        creditsDeducted: amount,
        batchesAffected: deductionResult.batches_affected
      };

    } catch (error) {
      // Fallback to old method if batch system fails
      console.warn('FIFO deduction failed, falling back to legacy method:', error.message);
      return await deductCreditsFromUserLegacy(userId, amount, operationType, operationId, description, metadata);
    }
  });
}

// Legacy deduction method (kept as fallback)
async function deductCreditsFromUserLegacy(userId, amount, operationType, operationId = null, description = '', metadata = {}) {
  return await retryDbOperation(async () => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Get current balance with lock
      const [balanceRows] = await connection.execute(
        'SELECT total_credits, used_credits, expired_credits FROM user_credits WHERE user_id = ? FOR UPDATE',
        [userId]
      );

      if (balanceRows.length === 0) {
        throw new Error('User credit account not found');
      }

      const currentTotal = parseFloat(balanceRows[0].total_credits);
      const currentUsed = parseFloat(balanceRows[0].used_credits);
      const expiredCredits = parseFloat(balanceRows[0].expired_credits || 0);
      const availableCredits = currentTotal - currentUsed - expiredCredits;

      if (availableCredits < parseFloat(amount)) {
        throw new Error(`Insufficient credits. Available: ${availableCredits}, Required: ${amount}`);
      }

      const newUsedCredits = currentUsed + parseFloat(amount);

      // Update used credits
      await connection.execute(
        `UPDATE user_credits
         SET used_credits = ?, last_usage_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [newUsedCredits, userId]
      );

      // Create transaction record
      const transactionId = uuidv4();
      await connection.execute(
        `INSERT INTO credit_transactions
         (transaction_id, user_id, type, amount, balance_before, balance_after, description, reference_type, reference_id, metadata)
         VALUES (?, ?, 'usage', ?, ?, ?, ?, ?, ?, ?)`,
        [transactionId, userId, -amount, availableCredits, availableCredits - amount, description, operationType, operationId, JSON.stringify(metadata)]
      );

      await connection.commit();
      return {
        transactionId,
        balanceBefore: availableCredits,
        balanceAfter: availableCredits - amount,
        creditsDeducted: amount
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  });
}

// Check if user has sufficient credits
async function checkSufficientCredits(userId, requiredAmount) {
  return await retryDbOperation(async () => {
    const balance = await getUserCreditBalance(userId);
    if (!balance) return false;
    
    return parseFloat(balance.available_credits) >= parseFloat(requiredAmount);
  });
}

// Get user credit transactions with pagination
async function getUserCreditTransactions(userId, page = 1, limit = 20, type = null) {
  return await retryDbOperation(async () => {
    const offset = (page - 1) * limit;

    // Build the main query
    let sql = 'SELECT transaction_id, type, amount, balance_before, balance_after, description, reference_type, reference_id, package_id, metadata, processed_at, created_at FROM credit_transactions WHERE user_id = ?';
    const params = [userId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ' + parseInt(limit) + ' OFFSET ' + parseInt(offset);

    const [rows] = await pool.execute(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM credit_transactions WHERE user_id = ?';
    const countParams = [userId];
    if (type) {
      countSql += ' AND type = ?';
      countParams.push(type);
    }

    const [countRows] = await pool.execute(countSql, countParams);
    const total = countRows[0].total;

    return {
      transactions: rows.map(row => ({
        ...row,
        metadata: row.metadata && typeof row.metadata === 'string' ?
          (() => {
            try {
              return JSON.parse(row.metadata);
            } catch (e) {
              console.warn('Invalid JSON in metadata:', row.metadata);
              return null;
            }
          })() : row.metadata
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  });
}

// Get credit usage analytics for user
async function getUserCreditAnalytics(userId, days = 30) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        DATE(created_at) as date,
        type,
        SUM(ABS(amount)) as total_amount,
        COUNT(*) as transaction_count
      FROM credit_transactions 
      WHERE user_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(created_at), type
      ORDER BY date DESC
    `;
    const [rows] = await pool.execute(sql, [userId, days]);

    // Get current balance
    const balance = await getUserCreditBalance(userId);

    // Get total usage by operation type
    const usageSql = `
      SELECT 
        operation_type,
        SUM(credits_consumed) as total_credits,
        COUNT(*) as operation_count,
        AVG(credits_consumed) as avg_credits_per_operation
      FROM usage_tracking 
      WHERE user_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY operation_type
      ORDER BY total_credits DESC
    `;
    const [usageRows] = await pool.execute(usageSql, [userId, days]);

    // Calculate summary statistics
    const totalCreditsConsumed = usageRows.reduce((sum, row) => sum + parseFloat(row.total_credits || 0), 0);
    const totalOperations = usageRows.reduce((sum, row) => sum + parseInt(row.operation_count || 0), 0);
    const avgCreditsPerOperation = totalOperations > 0 ? totalCreditsConsumed / totalOperations : 0;
    const successfulOperations = totalOperations; // Assuming all completed operations are successful

    return {
      summary: {
        total_credits_consumed: totalCreditsConsumed,
        total_operations: totalOperations,
        avg_credits_per_operation: avgCreditsPerOperation,
        successful_operations: successfulOperations,
        current_balance: balance?.available_credits || 0
      },
      dailyTransactions: rows,
      operationSummary: usageRows.map(row => ({
        operation_type: row.operation_type,
        total_credits: row.total_credits,
        operation_count: row.operation_count,
        avg_credits_per_operation: row.avg_credits_per_operation
      })),
      peakHours: [], // TODO: Implement peak hours analysis
      period: `${days} days`
    };
  });
}

// Admin function: Adjust user credits
async function adjustUserCredits(userId, amount, adminUserId, reason = '') {
  return await retryDbOperation(async () => {
    const type = amount > 0 ? 'bonus' : 'adjustment';
    const description = `Admin adjustment: ${reason}`;
    
    return await addCreditsToUser(userId, amount, type, description, `admin_${adminUserId}`);
  });
}

// Get low credit users (for alerts)
async function getLowCreditUsers(threshold = 10) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        uc.user_id,
        uc.available_credits,
        u.email,
        u.first_name,
        u.last_name,
        u.low_credit_threshold,
        u.credit_alerts_enabled
      FROM user_credits uc
      JOIN users u ON uc.user_id = u.id
      WHERE uc.available_credits <= COALESCE(u.low_credit_threshold, ?)
        AND u.credit_alerts_enabled = TRUE
        AND u.is_active = TRUE
    `;
    const [rows] = await pool.execute(sql, [threshold]);
    return rows;
  });
}

module.exports = {
  getUserCreditBalance,
  initializeUserCredits,
  addCreditsToUser,
  deductCreditsFromUser,
  checkSufficientCredits,
  getUserCreditTransactions,
  getUserCreditAnalytics,
  adjustUserCredits,
  getLowCreditUsers,
  validateUserExists
};
