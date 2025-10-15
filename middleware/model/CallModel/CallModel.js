const db = require("../../config/DBConnection");

// Retry function for database operations
async function retryDbOperation(operation, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);

      if (attempt === maxRetries) {
        throw error;
      }

      // Check if it's a connection error that might be retryable
      if (error.code === 'ECONNRESET' ||
          error.code === 'PROTOCOL_CONNECTION_LOST' ||
          error.code === 'ENOTFOUND' ||
          error.code === 'ETIMEDOUT') {
        console.log(`Retrying database operation in ${attempt * 1000}ms...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        continue;
      }

      // If it's not a retryable error, throw immediately
      throw error;
    }
  }
}

// Create call record
async function createCall(callData) {
  return await retryDbOperation(async () => {
    const {
      user_id,
      call_id,
      org_id,
      type = 'outbound', // outbound, inbound, web
      status = 'queued', // queued, ringing, in-progress, forwarding, ended
      assistant_id,
      squad_id,
      workflow_id,
      phone_number_id,
      customer_id,
      customer_number,
      duration = 0,
      cost = 0,
      transcript = '',
      recording_url,
      analysis,
      artifacts,
      end_reason,
      started_at,
      ended_at,
      metadata = {}
    } = callData;

    const insertSQL = `
      INSERT INTO calls (
        user_id, call_id, org_id, type, status, assistant_id, squad_id,
        workflow_id, phone_number_id, customer_id, customer_number,
        duration, cost, transcript, recording_url, analysis, artifacts,
        end_reason, started_at, ended_at, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      user_id,
      call_id,
      org_id,
      type,
      status,
      assistant_id,
      squad_id,
      workflow_id,
      phone_number_id,
      customer_id,
      customer_number,
      duration,
      cost,
      transcript,
      recording_url,
      JSON.stringify(analysis || {}),
      JSON.stringify(artifacts || {}),
      end_reason,
      started_at,
      ended_at,
      JSON.stringify(metadata)
    ];

    const [result] = await db.query(insertSQL, params);
    return result.insertId;
  });
}

// Get calls with pagination and filtering
async function getCalls(page, limit, filters = {}) {
  return await retryDbOperation(async () => {
    const {
      search = "",
      status = "",
      type = "",
      assistant_id = "",
      date_from = "",
      date_to = "",
      user_id = null
    } = filters;

    let values = [];
    let whereConditions = [];

    // Build WHERE conditions
    if (search) {
      whereConditions.push("(customer_number LIKE ? OR transcript LIKE ?)");
      values.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      whereConditions.push("status = ?");
      values.push(status);
    }

    if (type) {
      whereConditions.push("type = ?");
      values.push(type);
    }

    if (assistant_id) {
      whereConditions.push("assistant_id = ?");
      values.push(assistant_id);
    }

    if (date_from) {
      whereConditions.push("created_at >= ?");
      values.push(date_from);
    }

    if (date_to) {
      whereConditions.push("created_at <= ?");
      values.push(date_to);
    }

    if (user_id) {
      whereConditions.push("user_id = ?");
      values.push(user_id);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Count query
    const countQuery = `SELECT COUNT(*) AS total FROM calls ${whereClause}`;
    const [totalRows] = await db.query(countQuery, values);
    const totalCalls = totalRows[0]?.total || 0;

    // Calculate pagination
    const totalPages = Math.ceil(totalCalls / limit);
    const adjustedPage = page > totalPages && totalPages > 0 ? totalPages : page;
    const offset = (adjustedPage - 1) * limit;

    // Main query with joins
    const selectQuery = `
      SELECT c.*, 
             a.name as assistant_name,
             s.name as squad_name,
             w.name as workflow_name,
             pn.number as phone_number,
             cust.name as customer_name
      FROM calls c
      LEFT JOIN assistants a ON c.assistant_id = a.assistant_id
      LEFT JOIN squads s ON c.squad_id = s.squad_id
      LEFT JOIN workflows w ON c.workflow_id = w.workflow_id
      LEFT JOIN phone_numbers pn ON c.phone_number_id = pn.phone_number_id
      LEFT JOIN customers cust ON c.customer_id = cust.customer_id
      ${whereClause}
      ORDER BY c.created_at DESC 
      LIMIT ? OFFSET ?
    `;

    const [calls] = await db.query(selectQuery, [...values, limit, offset]);

    return {
      calls,
      pagination: {
        currentPage: adjustedPage,
        totalPages,
        totalItems: totalCalls,
        itemsPerPage: limit,
        hasNextPage: adjustedPage < totalPages,
        hasPrevPage: adjustedPage > 1
      }
    };
  });
}

// Get call by ID
async function getCallById(call_id) {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT c.*, 
             a.name as assistant_name,
             s.name as squad_name,
             w.name as workflow_name,
             pn.number as phone_number,
             cust.name as customer_name
      FROM calls c
      LEFT JOIN assistants a ON c.assistant_id = a.assistant_id
      LEFT JOIN squads s ON c.squad_id = s.squad_id
      LEFT JOIN workflows w ON c.workflow_id = w.workflow_id
      LEFT JOIN phone_numbers pn ON c.phone_number_id = pn.phone_number_id
      LEFT JOIN customers cust ON c.customer_id = cust.customer_id
      WHERE c.call_id = ?
    `;
    const [result] = await db.query(sql, [call_id]);
    return result[0] || null;
  });
}

// Update call
async function updateCall(call_id, updateData) {
  return await retryDbOperation(async () => {
    const {
      status,
      duration,
      cost,
      transcript,
      recording_url,
      analysis,
      artifacts,
      end_reason,
      started_at,
      ended_at,
      metadata
    } = updateData;

    const updateSQL = `
      UPDATE calls SET
        status = COALESCE(?, status),
        duration = COALESCE(?, duration),
        cost = COALESCE(?, cost),
        transcript = COALESCE(?, transcript),
        recording_url = COALESCE(?, recording_url),
        analysis = COALESCE(?, analysis),
        artifacts = COALESCE(?, artifacts),
        end_reason = COALESCE(?, end_reason),
        started_at = COALESCE(?, started_at),
        ended_at = COALESCE(?, ended_at),
        metadata = COALESCE(?, metadata),
        updated_at = NOW()
      WHERE call_id = ?
    `;

    const params = [
      status,
      duration,
      cost,
      transcript,
      recording_url,
      analysis ? JSON.stringify(analysis) : null,
      artifacts ? JSON.stringify(artifacts) : null,
      end_reason,
      started_at,
      ended_at,
      metadata ? JSON.stringify(metadata) : null,
      call_id
    ];

    const [result] = await db.query(updateSQL, params);
    return result.affectedRows;
  });
}

// Delete call
async function deleteCall(call_id) {
  return await retryDbOperation(async () => {
    const sql = "DELETE FROM calls WHERE call_id = ?";
    const [result] = await db.query(sql, [call_id]);
    return result.affectedRows;
  });
}

// Get call history for a specific contact by phone number
async function getCallHistoryByPhoneNumber(phoneNumber, page = 1, limit = 10, userId = null) {
  return await retryDbOperation(async () => {
    let values = [phoneNumber];
    let whereClause = "WHERE c.customer_number = ?";

    // Add user filter if provided
    if (userId) {
      whereClause += " AND c.user_id = ?";
      values.push(userId);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM calls c
      ${whereClause}
    `;
    const [totalRows] = await db.query(countQuery, values);
    const totalCalls = totalRows[0]?.total || 0;

    const totalPages = Math.ceil(totalCalls / limit);
    const currentPage = page > totalPages && totalPages > 0 ? totalPages : page;
    const offset = (currentPage - 1) * limit;

    // Main query with joins
    const selectQuery = `
      SELECT c.*,
             a.name as assistant_name,
             s.name as squad_name,
             w.name as workflow_name,
             pn.number as phone_number,
             cust.name as customer_name
      FROM calls c
      LEFT JOIN assistants a ON c.assistant_id = a.assistant_id
      LEFT JOIN squads s ON c.squad_id = s.squad_id
      LEFT JOIN workflows w ON c.workflow_id = w.workflow_id
      LEFT JOIN phone_numbers pn ON c.phone_number_id = pn.phone_number_id
      LEFT JOIN customers cust ON c.customer_id = cust.customer_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT ? OFFSET ?
    `;

    values.push(parseInt(limit), parseInt(offset));
    const [calls] = await db.query(selectQuery, values);

    return {
      calls,
      totalCalls,
      currentPage,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  });
}

// Get call analytics
async function getCallAnalytics(filters = {}) {
  return await retryDbOperation(async () => {
    const {
      date_from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      date_to = new Date().toISOString(),
      user_id = null,
      assistant_id = "",
      type = ""
    } = filters;

    let whereConditions = ["created_at BETWEEN ? AND ?"];
    let values = [date_from, date_to];

    if (user_id) {
      whereConditions.push("user_id = ?");
      values.push(user_id);
    }

    if (assistant_id) {
      whereConditions.push("assistant_id = ?");
      values.push(assistant_id);
    }

    if (type) {
      whereConditions.push("type = ?");
      values.push(type);
    }

    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // Overall metrics
    const overallSql = `
      SELECT 
        COUNT(*) as total_calls,
        AVG(duration) as avg_duration,
        SUM(cost) as total_cost,
        SUM(CASE WHEN status = 'ended' AND end_reason = 'customer-ended-call' THEN 1 ELSE 0 END) as successful_calls,
        SUM(CASE WHEN status = 'ended' AND end_reason != 'customer-ended-call' THEN 1 ELSE 0 END) as failed_calls,
        COUNT(DISTINCT customer_number) as unique_customers
      FROM calls 
      ${whereClause}
    `;

    const [overallMetrics] = await db.query(overallSql, values);

    // Daily breakdown
    const dailySql = `
      SELECT 
        DATE(created_at) as call_date,
        COUNT(*) as daily_calls,
        AVG(duration) as avg_duration,
        SUM(cost) as daily_cost
      FROM calls 
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY call_date DESC
      LIMIT 30
    `;

    const [dailyBreakdown] = await db.query(dailySql, values);

    // Status distribution
    const statusSql = `
      SELECT 
        status,
        COUNT(*) as count,
        (COUNT(*) * 100.0 / (SELECT COUNT(*) FROM calls ${whereClause})) as percentage
      FROM calls 
      ${whereClause}
      GROUP BY status
    `;

    const [statusDistribution] = await db.query(statusSql, [...values, ...values]);

    return {
      overall: overallMetrics[0] || {},
      daily_breakdown: dailyBreakdown,
      status_distribution: statusDistribution
    };
  });
}

// Get active calls
async function getActiveCalls(user_id = null) {
  return await retryDbOperation(async () => {
    let sql = `
      SELECT c.*, 
             a.name as assistant_name,
             s.name as squad_name,
             w.name as workflow_name
      FROM calls c
      LEFT JOIN assistants a ON c.assistant_id = a.assistant_id
      LEFT JOIN squads s ON c.squad_id = s.squad_id
      LEFT JOIN workflows w ON c.workflow_id = w.workflow_id
      WHERE c.status IN ('queued', 'ringing', 'in-progress', 'forwarding')
    `;

    let params = [];

    if (user_id) {
      sql += " AND c.user_id = ?";
      params.push(user_id);
    }

    sql += " ORDER BY c.created_at DESC";

    const [activeCalls] = await db.query(sql, params);
    return activeCalls;
  });
}

module.exports = {
  createCall,
  getCalls,
  getCallById,
  updateCall,
  deleteCall,
  getCallAnalytics,
  getActiveCalls,
  getCallHistoryByPhoneNumber
};
