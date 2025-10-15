const pool = require("../../config/DBConnection");
const { v4: uuidv4 } = require('uuid');

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

// Create usage tracking record
async function createUsageRecord(usageData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      operation_type,
      operation_id = null,
      credits_consumed,
      unit_cost,
      units_consumed,
      unit_type,
      operation_details = {},
      started_at = null,
      duration_seconds = null,
      status = 'pending',
      metadata = {}
    } = usageData;

    const usage_id = uuidv4();

    const sql = `
      INSERT INTO usage_tracking (
        usage_id, user_id, operation_type, operation_id, credits_consumed,
        unit_cost, units_consumed, unit_type, operation_details,
        started_at, duration_seconds, status, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(sql, [
      usage_id,
      user_id,
      operation_type,
      operation_id,
      credits_consumed,
      unit_cost,
      units_consumed,
      unit_type,
      JSON.stringify(operation_details),
      started_at,
      duration_seconds,
      status,
      JSON.stringify(metadata)
    ]);

    return {
      id: result.insertId,
      usage_id,
      affectedRows: result.affectedRows
    };
  });
}

// Update usage record (typically to mark as completed)
async function updateUsageRecord(usageId, updateData) {
  return await retryDbOperation(async () => {
    const allowedFields = [
      'credits_consumed', 'units_consumed', 'duration_seconds', 
      'completed_at', 'status', 'error_message', 'operation_details', 'metadata'
    ];

    const updateFields = [];
    const updateValues = [];

    Object.keys(updateData).forEach(key => {
      if (allowedFields.includes(key)) {
        updateFields.push(`${key} = ?`);
        if (key === 'operation_details' || key === 'metadata') {
          updateValues.push(JSON.stringify(updateData[key]));
        } else {
          updateValues.push(updateData[key]);
        }
      }
    });

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(usageId);

    const sql = `
      UPDATE usage_tracking 
      SET ${updateFields.join(', ')}
      WHERE usage_id = ?
    `;

    const [result] = await pool.execute(sql, updateValues);
    return {
      affectedRows: result.affectedRows,
      updated: result.affectedRows > 0
    };
  });
}

// Get usage record by ID
async function getUsageRecord(usageId) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT 
        id, usage_id, user_id, operation_type, operation_id,
        credits_consumed, unit_cost, units_consumed, unit_type,
        operation_details, started_at, completed_at, duration_seconds,
        status, error_message, metadata, created_at, updated_at
      FROM usage_tracking 
      WHERE usage_id = ?
    `;

    const [rows] = await pool.execute(sql, [usageId]);
    
    if (rows.length === 0) return null;
    
    const record = rows[0];
    return {
      ...record,
      operation_details: record.operation_details ? JSON.parse(record.operation_details) : null,
      metadata: record.metadata ? JSON.parse(record.metadata) : null
    };
  });
}

// Get user usage history with pagination
async function getUserUsageHistory(userId, page = 1, limit = 20, operationType = null, status = null) {
  return await retryDbOperation(async () => {
    // Validate parameters
    if (!userId || (typeof userId !== 'string' && typeof userId !== 'number')) {
      throw new Error(`Invalid userId: ${userId} (type: ${typeof userId})`);
    }

    const pageValue = parseInt(page, 10);
    const limitValue = parseInt(limit, 10);

    if (isNaN(pageValue) || pageValue <= 0) {
      throw new Error(`Invalid page value: ${page}`);
    }

    if (isNaN(limitValue) || limitValue <= 0) {
      throw new Error(`Invalid limit value: ${limit}`);
    }

    const offset = (pageValue - 1) * limitValue;
    let sql = `
      SELECT 
        usage_id, operation_type, operation_id, credits_consumed,
        unit_cost, units_consumed, unit_type, started_at, completed_at,
        duration_seconds, status, error_message, created_at
      FROM usage_tracking 
      WHERE user_id = ?
    `;
    const params = [userId];

    if (operationType) {
      sql += ' AND operation_type = ?';
      params.push(operationType);
    }

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limitValue, offset);

    const [rows] = await pool.execute(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM usage_tracking WHERE user_id = ?';
    const countParams = [userId];
    
    if (operationType) {
      countSql += ' AND operation_type = ?';
      countParams.push(operationType);
    }
    
    if (status) {
      countSql += ' AND status = ?';
      countParams.push(status);
    }

    const [countRows] = await pool.execute(countSql, countParams);
    const total = countRows[0].total;

    return {
      usage: rows,
      pagination: {
        page: pageValue,
        limit: limitValue,
        total,
        totalPages: Math.ceil(total / limitValue)
      }
    };
  });
}

// Get usage analytics for user
async function getUserUsageAnalytics(userId, days = 30) {
  return await retryDbOperation(async () => {
    // Daily usage breakdown
    const dailyUsageSql = `
      SELECT 
        DATE(created_at) as date,
        operation_type,
        SUM(credits_consumed) as total_credits,
        SUM(units_consumed) as total_units,
        COUNT(*) as operation_count,
        AVG(credits_consumed) as avg_credits_per_operation
      FROM usage_tracking 
      WHERE user_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY DATE(created_at), operation_type
      ORDER BY date DESC
    `;
    const [dailyRows] = await pool.execute(dailyUsageSql, [userId, days]);

    // Operation type summary
    const operationSummarySql = `
      SELECT 
        operation_type,
        SUM(credits_consumed) as total_credits,
        SUM(units_consumed) as total_units,
        COUNT(*) as operation_count,
        AVG(credits_consumed) as avg_credits_per_operation,
        MIN(created_at) as first_usage,
        MAX(created_at) as last_usage
      FROM usage_tracking 
      WHERE user_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY operation_type
      ORDER BY total_credits DESC
    `;
    const [operationRows] = await pool.execute(operationSummarySql, [userId, days]);

    // Peak usage hours
    const peakHoursSql = `
      SELECT 
        HOUR(created_at) as hour,
        SUM(credits_consumed) as total_credits,
        COUNT(*) as operation_count
      FROM usage_tracking 
      WHERE user_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY HOUR(created_at)
      ORDER BY total_credits DESC
      LIMIT 5
    `;
    const [peakHoursRows] = await pool.execute(peakHoursSql, [userId, days]);

    // Total summary
    const totalSummarySql = `
      SELECT 
        SUM(credits_consumed) as total_credits_consumed,
        COUNT(*) as total_operations,
        COUNT(DISTINCT operation_type) as unique_operation_types,
        AVG(credits_consumed) as avg_credits_per_operation,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_operations,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_operations
      FROM usage_tracking 
      WHERE user_id = ? 
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;
    const [totalRows] = await pool.execute(totalSummarySql, [userId, days]);

    return {
      period: `${days} days`,
      summary: totalRows[0],
      dailyUsage: dailyRows,
      operationSummary: operationRows,
      peakHours: peakHoursRows
    };
  });
}

// Get system-wide usage analytics (admin)
async function getSystemUsageAnalytics(days = 30) {
  return await retryDbOperation(async () => {
    // Top users by usage
    const topUsersSql = `
      SELECT 
        ut.user_id,
        u.email,
        u.first_name,
        u.last_name,
        SUM(ut.credits_consumed) as total_credits,
        COUNT(ut.id) as total_operations
      FROM usage_tracking ut
      JOIN users u ON ut.user_id = u.id
      WHERE ut.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND ut.status = 'completed'
      GROUP BY ut.user_id, u.email, u.first_name, u.last_name
      ORDER BY total_credits DESC
      LIMIT 10
    `;
    const [topUsersRows] = await pool.execute(topUsersSql, [days]);

    // Operation type breakdown
    const operationBreakdownSql = `
      SELECT 
        operation_type,
        SUM(credits_consumed) as total_credits,
        COUNT(*) as operation_count,
        COUNT(DISTINCT user_id) as unique_users,
        AVG(credits_consumed) as avg_credits_per_operation
      FROM usage_tracking 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY operation_type
      ORDER BY total_credits DESC
    `;
    const [operationRows] = await pool.execute(operationBreakdownSql, [days]);

    // Daily system usage
    const dailySystemSql = `
      SELECT 
        DATE(created_at) as date,
        SUM(credits_consumed) as total_credits,
        COUNT(*) as total_operations,
        COUNT(DISTINCT user_id) as active_users
      FROM usage_tracking 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
        AND status = 'completed'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    const [dailySystemRows] = await pool.execute(dailySystemSql, [days]);

    return {
      period: `${days} days`,
      topUsers: topUsersRows,
      operationBreakdown: operationRows,
      dailySystemUsage: dailySystemRows
    };
  });
}

// Track VAPI call usage
async function trackVAPICallUsage(userId, callId, durationMinutes, callDetails = {}) {
  return await retryDbOperation(async () => {
    // Get current pricing for VAPI calls
    const [pricingRows] = await pool.execute(
      'SELECT credits_per_unit FROM credit_pricing WHERE operation_type = ? AND unit_type = ? AND is_active = TRUE ORDER BY effective_from DESC LIMIT 1',
      ['vapi_call', 'per_minute']
    );

    const creditsPerMinute = pricingRows[0]?.credits_per_unit || 0.50;
    const totalCredits = durationMinutes * creditsPerMinute;

    return await createUsageRecord({
      user_id: userId,
      operation_type: 'vapi_call',
      operation_id: callId,
      credits_consumed: totalCredits,
      unit_cost: creditsPerMinute,
      units_consumed: durationMinutes,
      unit_type: 'minutes',
      operation_details: callDetails,
      duration_seconds: durationMinutes * 60,
      status: 'completed'
    });
  });
}

module.exports = {
  createUsageRecord,
  updateUsageRecord,
  getUsageRecord,
  getUserUsageHistory,
  getUserUsageAnalytics,
  getSystemUsageAnalytics,
  trackVAPICallUsage
};
