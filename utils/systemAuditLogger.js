/**
 * System Audit Logger
 * Handles logging of system operations, external API calls, and other non-standard operations
 */

const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');
const { v4: uuidv4 } = require('uuid');

// Helper function to get real client IP address
const getRealClientIP = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const clientIP = req.headers['x-client-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip'];
  const trueClientIP = req.headers['true-client-ip'];
  const xClusterClientIP = req.headers['x-cluster-client-ip'];

  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    const firstIP = ips[0];
    if (firstIP && firstIP !== '127.0.0.1' && firstIP !== '::1' && firstIP !== 'localhost') {
      return firstIP;
    }
  }

  if (cfConnectingIP && cfConnectingIP !== '127.0.0.1' && cfConnectingIP !== '::1') return cfConnectingIP;
  if (trueClientIP && trueClientIP !== '127.0.0.1' && trueClientIP !== '::1') return trueClientIP;
  if (realIP && realIP !== '127.0.0.1' && realIP !== '::1') return realIP;
  if (clientIP && clientIP !== '127.0.0.1' && clientIP !== '::1') return clientIP;
  if (xClusterClientIP && xClusterClientIP !== '127.0.0.1' && xClusterClientIP !== '::1') return xClusterClientIP;

  const connectionIP = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;
  return connectionIP || 'Unknown IP';
};

// Helper function to extract browser information
const getBrowserInfo = (userAgent) => {
  if (!userAgent) return { browser: 'Unknown Browser', engine: 'Unknown Engine' };
  
  let browser = 'Other Browser';
  let engine = 'Unknown Engine';
  
  if (userAgent.includes('Chrome')) {
    browser = 'Chrome';
    engine = 'Blink';
  } else if (userAgent.includes('Firefox')) {
    browser = 'Firefox';
    engine = 'Gecko';
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser = 'Safari';
    engine = 'WebKit';
  } else if (userAgent.includes('Edge')) {
    browser = 'Edge';
    engine = 'Blink';
  } else if (userAgent.includes('Opera')) {
    browser = 'Opera';
    engine = 'Blink';
  }
  
  return { browser, engine };
};

// Generic system operation logger
const logSystemOperation = async (req, operationType, tableName, recordId = null, userData = null, additionalData = {}) => {
  try {
    const startTime = Date.now();
    const { browser, engine } = getBrowserInfo(req.headers['user-agent']);
    
    const auditData = {
      user_id: userData?.id || req.user?.id || null,
      user_email: userData?.email || req.user?.email || 'System',
      user_name: userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : 
                 req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : 'System User',
      operation_type: operationType,
      table_name: tableName,
      record_id: recordId,
      old_values: additionalData.oldValues || null,
      new_values: additionalData.newValues || null,
      changed_fields: additionalData.changedFields || null,
      ip_address: getRealClientIP(req),
      user_agent: req.headers['user-agent'],
      request_method: req.method,
      request_url: req.url,
      request_body: additionalData.logRequestBody ? req.body : null,
      response_status: additionalData.responseStatus || 200,
      execution_time_ms: Date.now() - startTime,
      error_message: additionalData.errorMessage || null,
      metadata: {
        headers: {
          'content-type': req.headers['content-type'],
          'authorization': req.headers['authorization'] ? '[REDACTED]' : null
        },
        query: req.query,
        params: req.params,
        browser_info: {
          browser,
          engine
        },
        system_details: {
          operation_type: operationType,
          success: additionalData.success !== false,
          failure_reason: additionalData.failureReason || null,
          external_api: additionalData.externalApi || null,
          api_response: additionalData.apiResponse || null
        }
      },
      session_id: req.sessionID || uuidv4(),
      transaction_id: uuidv4()
    };

    // Create audit log entry
    await AuditLogModel.createAuditLog(auditData);
    console.log(`✅ System audit log created: ${operationType} on ${tableName} for ${auditData.user_email}`);
    
  } catch (error) {
    console.error('Error creating system audit log:', error);
    // Don't throw error to avoid breaking the main request
  }
};

// Log VAPI API calls
const logVAPICall = async (req, operation, endpoint, requestData, responseData, success = true, errorMessage = null) => {
  await logSystemOperation(req, 'VAPI_CALL', 'vapi_calls', null, null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    externalApi: 'VAPI',
    newValues: {
      operation,
      endpoint,
      request_data: requestData,
      response_data: responseData
    },
    logRequestBody: true
  });
};

// Log Facebook API calls
const logFacebookCall = async (req, operation, endpoint, requestData, responseData, success = true, errorMessage = null) => {
  await logSystemOperation(req, 'AUTHENTICATE', 'facebook_integrations', null, null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    externalApi: 'Facebook',
    newValues: {
      operation,
      endpoint,
      request_data: requestData,
      response_data: responseData
    },
    logRequestBody: true
  });
};

// Log webhook operations
const logWebhookOperation = async (req, operation, webhookData, success = true, errorMessage = null) => {
  await logSystemOperation(req, operation, 'webhooks', webhookData?.id || null, null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    newValues: webhookData,
    logRequestBody: true
  });
};

// Log file operations
const logFileOperation = async (req, operation, fileName, fileData, success = true, errorMessage = null) => {
  await logSystemOperation(req, operation, 'files', fileName, null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    newValues: {
      file_name: fileName,
      file_data: fileData
    },
    logRequestBody: false
  });
};

// Log export operations
const logExportOperation = async (req, exportType, fileName, recordCount, success = true, errorMessage = null) => {
  await logSystemOperation(req, exportType, 'exports', fileName, null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    newValues: {
      export_type: exportType,
      file_name: fileName,
      record_count: recordCount
    },
    logRequestBody: false
  });
};

// Log cleanup operations
const logCleanupOperation = async (req, cleanupType, tableName, recordsAffected, success = true, errorMessage = null) => {
  await logSystemOperation(req, cleanupType, tableName, null, null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    newValues: {
      cleanup_type: cleanupType,
      records_affected: recordsAffected
    },
    logRequestBody: false
  });
};

// Log cache operations
const logCacheOperation = async (req, operation, cacheKey, success = true, errorMessage = null) => {
  await logSystemOperation(req, operation, 'cache_operations', cacheKey, null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    newValues: {
      cache_key: cacheKey,
      operation
    },
    logRequestBody: false
  });
};

// Log database operations that bypass middleware
const logDirectDatabaseOperation = async (tableName, operation, recordId, oldValues, newValues, userId = null, userEmail = 'System') => {
  try {
    const auditData = {
      user_id: userId,
      user_email: userEmail,
      user_name: 'Direct Database Operation',
      operation_type: operation,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      changed_fields: operation === 'UPDATE' ? Object.keys(newValues || {}) : null,
      ip_address: 'Database Server',
      user_agent: 'Direct Database Access',
      request_method: 'DATABASE',
      request_url: `/database/${tableName}`,
      request_body: null,
      response_status: 200,
      execution_time_ms: 0,
      error_message: null,
      metadata: {
        system_details: {
          operation_type: operation,
          success: true,
          direct_database: true
        }
      },
      session_id: uuidv4(),
      transaction_id: uuidv4()
    };

    await AuditLogModel.createAuditLog(auditData);
    console.log(`✅ Direct database audit log created: ${operation} on ${tableName}`);
    
  } catch (error) {
    console.error('Error creating direct database audit log:', error);
  }
};

// Log Gmail operations
const logGmailOperation = async (req, operation, data, success = true, errorMessage = null) => {
  await logSystemOperation(req, operation, 'gmail_operations', data.userId || 'unknown', null, {
    success,
    errorMessage,
    responseStatus: success ? 200 : 500,
    newValues: data,
    logRequestBody: false
  });
};

module.exports = {
  logSystemOperation,
  logVAPICall,
  logFacebookCall,
  logWebhookOperation,
  logFileOperation,
  logExportOperation,
  logCleanupOperation,
  logCacheOperation,
  logDirectDatabaseOperation,
  logGmailOperation,
  getRealClientIP,
  getBrowserInfo
};
