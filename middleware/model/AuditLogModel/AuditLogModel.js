const pool = require("../../config/DBConnection");
const { v4: uuidv4 } = require('uuid');
const fs = require('fs-extra');
const path = require('path');

/**
 * Audit Log Model
 * Handles all database operations for audit logging
 */

// Helper function to update combined.txt file directly with comprehensive data
const updateCombinedTextFile = async (auditLog) => {
  try {
    const logsDir = path.join(process.cwd(), 'Logs');
    const combinedFilePath = path.join(logsDir, 'combined.txt');

    await fs.ensureDir(logsDir);

    // Extract comprehensive information
    const timestamp = auditLog.created_at;
    const operation = auditLog.operation_type;
    const table = auditLog.table_name;
    const user = auditLog.user_email || 'Unknown';
    const userName = auditLog.user_name || 'Unknown User';
    const recordId = auditLog.record_id || 'N/A';
    const status = auditLog.response_status || 'N/A';
    const ipAddress = auditLog.ip_address || 'Unknown IP';
    const userAgent = auditLog.user_agent || 'Unknown Browser';
    const executionTime = auditLog.execution_time_ms || 0;
    const requestUrl = auditLog.request_url || 'N/A';
    const requestMethod = auditLog.request_method || 'N/A';

    // Extract browser info from user agent
    const getBrowserInfo = (userAgent) => {
      if (!userAgent) return 'Unknown Browser';
      if (userAgent.includes('Chrome')) return 'Chrome';
      if (userAgent.includes('Firefox')) return 'Firefox';
      if (userAgent.includes('Safari')) return 'Safari';
      if (userAgent.includes('Edge')) return 'Edge';
      return 'Other Browser';
    };

    const browserInfo = getBrowserInfo(userAgent);

    // Format old/new values for display
    const formatValues = (values) => {
      if (!values) return 'N/A';
      try {
        const parsed = typeof values === 'string' ? JSON.parse(values) : values;
        return JSON.stringify(parsed).substring(0, 200) + (JSON.stringify(parsed).length > 200 ? '...' : '');
      } catch {
        return String(values).substring(0, 200);
      }
    };

    const oldValues = formatValues(auditLog.old_values);
    const newValues = formatValues(auditLog.new_values);

    // Create comprehensive log entry
    const textContent = `[${timestamp}] ${operation} on ${table} by ${user} (${userName}) | IP: ${ipAddress} | Browser: ${browserInfo} | Method: ${requestMethod} | URL: ${requestUrl} | Record ID: ${recordId} | Status: ${status} | Time: ${executionTime}ms | Old: ${oldValues} | New: ${newValues}\n`;

    // Append to combined.txt
    await fs.appendFile(combinedFilePath, textContent);
    console.log(`✅ Updated combined.txt with comprehensive audit log: ${operation} on ${table}`);
  } catch (error) {
    console.error('Error updating combined.txt:', error);
  }
};

// Create a new audit log entry
const createAuditLog = async (auditData) => {
  try {
    const {
      user_id,
      user_email,
      user_name,
      operation_type,
      table_name,
      record_id,
      old_values,
      new_values,
      changed_fields,
      ip_address,
      user_agent,
      request_method,
      request_url,
      request_body,
      response_status,
      execution_time_ms,
      error_message,
      metadata,
      session_id,
      transaction_id
    } = auditData;

    const sql = `
      INSERT INTO audit_logs (
        user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const [result] = await pool.execute(sql, [
      user_id || null,
      user_email || null,
      user_name || null,
      operation_type,
      table_name,
      record_id || null,
      old_values ? JSON.stringify(old_values) : null,
      new_values ? JSON.stringify(new_values) : null,
      changed_fields ? JSON.stringify(changed_fields) : null,
      ip_address || null,
      user_agent || null,
      request_method || null,
      request_url || null,
      request_body ? JSON.stringify(request_body) : null,
      response_status || null,
      execution_time_ms || null,
      error_message || null,
      metadata ? JSON.stringify(metadata) : null,
      session_id || uuidv4(),
      transaction_id || uuidv4()
    ]);

    // Immediately update combined.txt file with the new audit log
    try {
      const newAuditLog = {
        id: result.insertId,
        user_id: user_id || null,
        user_email: user_email || null,
        user_name: user_name || null,
        operation_type,
        table_name,
        record_id: record_id || null,
        old_values: old_values ? JSON.stringify(old_values) : null,
        new_values: new_values ? JSON.stringify(new_values) : null,
        changed_fields: changed_fields ? JSON.stringify(changed_fields) : null,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        request_method: request_method || null,
        request_url: request_url || null,
        request_body: request_body ? JSON.stringify(request_body) : null,
        response_status: response_status || null,
        execution_time_ms: execution_time_ms || null,
        error_message: error_message || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
        session_id: session_id || uuidv4(),
        transaction_id: transaction_id || uuidv4(),
        created_at: new Date().toISOString()
      };

      // Update combined.txt file immediately using direct function
      await updateCombinedTextFile(newAuditLog);
    } catch (combinedTxtError) {
      console.error('Error updating combined.txt after creating audit log:', combinedTxtError);
      // Don't throw error to avoid breaking the audit log creation
    }

    return result.insertId;
  } catch (error) {
    console.error('Error creating audit log:', error);
    throw error;
  }
};

// Get audit logs with filtering and pagination
const getAuditLogs = async (filters = {}) => {
  try {
    const {
      user_id,
      user_email,
      operation_type,
      table_name,
      record_id,
      start_date,
      end_date,
      limit = 50,
      offset = 0,
      sort_by = 'created_at',
      sort_order = 'DESC'
    } = filters;

    let whereConditions = [];
    let queryParams = [];

    // Build WHERE conditions dynamically
    if (user_id) {
      whereConditions.push('user_id = ?');
      queryParams.push(user_id);
    }

    if (user_email) {
      whereConditions.push('user_email LIKE ?');
      queryParams.push(`%${user_email}%`);
    }

    if (operation_type) {
      whereConditions.push('operation_type = ?');
      queryParams.push(operation_type);
    }

    if (table_name) {
      whereConditions.push('table_name = ?');
      queryParams.push(table_name);
    }

    if (record_id) {
      whereConditions.push('record_id = ?');
      queryParams.push(record_id);
    }

    if (start_date) {
      whereConditions.push('created_at >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('created_at <= ?');
      queryParams.push(end_date);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const [countResult] = await pool.execute(countSql, queryParams);
    const total = countResult[0].total;

    // Get paginated results - use separate query to avoid parameter issues
    let paginatedSql;
    let paginatedParams;

    if (whereConditions.length > 0) {
      paginatedSql = `
        SELECT
          id, user_id, user_email, user_name, operation_type, table_name, record_id,
          old_values, new_values, changed_fields, ip_address, user_agent,
          request_method, request_url, request_body, response_status,
          execution_time_ms, error_message, metadata, session_id, transaction_id,
          created_at
        FROM audit_logs
        ${whereClause}
        ORDER BY ${sort_by} ${sort_order}
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
      paginatedParams = queryParams;
    } else {
      paginatedSql = `
        SELECT
          id, user_id, user_email, user_name, operation_type, table_name, record_id,
          old_values, new_values, changed_fields, ip_address, user_agent,
          request_method, request_url, request_body, response_status,
          execution_time_ms, error_message, metadata, session_id, transaction_id,
          created_at
        FROM audit_logs
        ORDER BY ${sort_by} ${sort_order}
        LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}
      `;
      paginatedParams = [];
    }

    const [rows] = await pool.execute(paginatedSql, paginatedParams);

    // Parse JSON fields safely and enhance display
    const parsedRows = rows.map(row => {
      const parseJsonField = (field) => {
        if (!field) return null;
        if (typeof field === 'object') return field; // Already parsed
        if (typeof field === 'string') {
          try {
            return JSON.parse(field);
          } catch (e) {
            return field; // Return as string if not valid JSON
          }
        }
        return field;
      };

      // Extract browser information from user agent
      const getBrowserInfo = (userAgent) => {
        if (!userAgent) return 'Unknown';

        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        if (userAgent.includes('Opera')) return 'Opera';
        return 'Other';
      };

      // Determine display operation based on context
      const getDisplayOperation = (operationType, tableName, metadata, newValues) => {
        const parsedMetadata = parseJsonField(metadata);
        const parsedNewValues = parseJsonField(newValues);

        // Check if this is an authentication event
        if (parsedMetadata && parsedMetadata.authentication_event) {
          if (parsedMetadata.action === 'LOGIN') return 'Login';
          if (parsedMetadata.action === 'LOGOUT') return 'Logout';
        }

        // Check table name for auth sessions
        if (tableName === 'auth_sessions') {
          if (parsedNewValues && parsedNewValues.action === 'LOGIN') return 'Login';
          if (parsedNewValues && parsedNewValues.action === 'LOGOUT') return 'Logout';
        }

        // Check new values for action field
        if (parsedNewValues && parsedNewValues.action) {
          if (parsedNewValues.action === 'LOGIN') return 'Login';
          if (parsedNewValues.action === 'LOGOUT') return 'Logout';
        }

        // Default operation types
        return operationType;
      };

      // Keep original IP address format (including IPv6)
      const formatIpAddress = (ipAddress) => {
        if (!ipAddress) return 'Unknown';
        return ipAddress; // Return original IP address without conversion
      };

      return {
        ...row,
        old_values: parseJsonField(row.old_values),
        new_values: parseJsonField(row.new_values),
        changed_fields: parseJsonField(row.changed_fields),
        request_body: parseJsonField(row.request_body),
        metadata: parseJsonField(row.metadata),
        browser_info: getBrowserInfo(row.user_agent),
        display_operation: getDisplayOperation(row.operation_type, row.table_name, row.metadata, row.new_values),
        ip_address: formatIpAddress(row.ip_address)
      };
    });

    return {
      data: parsedRows,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      hasMore: (parseInt(offset) + parseInt(limit)) < total
    };
  } catch (error) {
    console.error('Error getting audit logs:', error);
    throw error;
  }
};

// Get audit log by ID
const getAuditLogById = async (id) => {
  try {
    const sql = `
      SELECT 
        id, user_id, user_email, user_name, operation_type, table_name, record_id,
        old_values, new_values, changed_fields, ip_address, user_agent,
        request_method, request_url, request_body, response_status,
        execution_time_ms, error_message, metadata, session_id, transaction_id,
        created_at
      FROM audit_logs 
      WHERE id = ?
    `;

    const [rows] = await pool.execute(sql, [id]);
    
    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      ...row,
      old_values: row.old_values ? JSON.parse(row.old_values) : null,
      new_values: row.new_values ? JSON.parse(row.new_values) : null,
      changed_fields: row.changed_fields ? JSON.parse(row.changed_fields) : null,
      request_body: row.request_body ? JSON.parse(row.request_body) : null,
      metadata: row.metadata ? JSON.parse(row.metadata) : null
    };
  } catch (error) {
    console.error('Error getting audit log by ID:', error);
    throw error;
  }
};

// Get audit log statistics
const getAuditLogStats = async (filters = {}) => {
  try {
    const {
      start_date,
      end_date,
      user_id,
      table_name
    } = filters;

    let whereConditions = [];
    let queryParams = [];

    if (start_date) {
      whereConditions.push('created_at >= ?');
      queryParams.push(start_date);
    }

    if (end_date) {
      whereConditions.push('created_at <= ?');
      queryParams.push(end_date);
    }

    if (user_id) {
      whereConditions.push('user_id = ?');
      queryParams.push(user_id);
    }

    if (table_name) {
      whereConditions.push('table_name = ?');
      queryParams.push(table_name);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get operation type statistics
    const operationStatsSql = `
      SELECT operation_type, COUNT(*) as count
      FROM audit_logs ${whereClause}
      GROUP BY operation_type
    `;

    // Get table statistics
    const tableStatsSql = `
      SELECT table_name, COUNT(*) as count
      FROM audit_logs ${whereClause}
      GROUP BY table_name
      ORDER BY count DESC
      LIMIT 10
    `;

    // Get user statistics
    const userWhereClause = whereConditions.length > 0
      ? `${whereClause} AND user_email IS NOT NULL`
      : 'WHERE user_email IS NOT NULL';

    const userStatsSql = `
      SELECT user_email, user_name, COUNT(*) as count
      FROM audit_logs ${userWhereClause}
      GROUP BY user_email, user_name
      ORDER BY count DESC
      LIMIT 10
    `;

    // Get daily activity
    const dailyActivitySql = `
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM audit_logs ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    const [operationStats] = await pool.execute(operationStatsSql, queryParams);
    const [tableStats] = await pool.execute(tableStatsSql, queryParams);
    const [userStats] = await pool.execute(userStatsSql, queryParams);
    const [dailyActivity] = await pool.execute(dailyActivitySql, queryParams);

    return {
      operationStats,
      tableStats,
      userStats,
      dailyActivity
    };
  } catch (error) {
    console.error('Error getting audit log stats:', error);
    throw error;
  }
};

// Delete old audit logs (for cleanup)
const deleteOldAuditLogs = async (daysToKeep = 90) => {
  try {
    const sql = `
      DELETE FROM audit_logs 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const [result] = await pool.execute(sql, [daysToKeep]);
    return result.affectedRows;
  } catch (error) {
    console.error('Error deleting old audit logs:', error);
    throw error;
  }
};

module.exports = {
  createAuditLog,
  getAuditLogs,
  getAuditLogById,
  getAuditLogStats,
  deleteOldAuditLogs
};
