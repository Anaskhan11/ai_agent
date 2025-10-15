const AuditLogModel = require('../model/AuditLogModel/AuditLogModel');
const pool = require('../config/DBConnection');
const { v4: uuidv4 } = require('uuid');

/**
 * Audit Log Middleware
 * Automatically captures and logs all CRUD operations
 */

// Helper function to extract table name from URL
const extractTableNameFromUrl = (url, method) => {
  // Remove query parameters
  const cleanUrl = url.split('?')[0];
  
  // Common API patterns to table name mapping
  const tableMapping = {
    '/api/users': 'users',
    '/api/roles': 'roles',
    '/api/contacts': 'contacts',
    '/api/lists': 'lists',
    '/api/assistant': 'assistants',
    '/api/outboundcall': 'outbound_calls',
    '/api/models': 'models',
    '/api/voices': 'voices',
    '/api/transcribers': 'transcribers',
    '/api/phone-numbers': 'phone_numbers',
    '/api/tools': 'tools',
    '/api/files': 'files',
    '/api/knowledge-bases': 'knowledge_bases',
    '/api/sessions': 'sessions',
    '/api/chats': 'chats',
    '/api/squads': 'squads',
    '/api/workflows': 'workflows',
    '/api/analytics': 'analytics',
    '/api/logs': 'logs',
    '/api/webhooks': 'webhooks',
    '/api/recordings': 'recordings',
    '/api/permissions': 'permissions',
    '/api/role-permissions': 'role_permissions',
    '/api/support': 'support_tickets',
    '/api/page-permissions': 'page_permissions',
    '/api/user-permissions': 'user_permissions',
    '/api/user-roles': 'user_roles',
    '/api/role-page-permissions': 'role_page_permissions',
    '/api/dashboard': 'dashboard',
    '/api/vapi': 'vapi_calls',
    '/api/facebook': 'facebook_integrations',
    '/api/webhook-test': 'webhook_tests',
    '/api/auth': 'auth_sessions',
    '/api/trans_voice_model': 'transcriber_voice_models',
    '/api/campaigns': 'campaigns',
    '/api/email-verification-otps': 'email_verification_otps'
  };

  // Try exact match first
  for (const [pattern, tableName] of Object.entries(tableMapping)) {
    if (cleanUrl.startsWith(pattern)) {
      return tableName;
    }
  }

  // Extract from URL pattern like /api/entity or /api/entity/id
  const matches = cleanUrl.match(/^\/api\/([^\/]+)/);
  if (matches) {
    return matches[1].replace(/-/g, '_'); // Convert kebab-case to snake_case
  }

  return 'unknown';
};

// Helper function to determine operation type
const getOperationType = (method, url) => {
  const cleanUrl = url.split('?')[0];

  switch (method.toUpperCase()) {
    case 'POST':
      // Special handling for authentication operations
      if (cleanUrl.includes('/login') || cleanUrl.includes('/auth')) {
        return 'LOGIN';
      }
      if (cleanUrl.includes('/logout')) {
        return 'LOGOUT';
      }
      if (cleanUrl.includes('/verify-otp') || cleanUrl.includes('/resend-otp')) {
        return 'VERIFY';
      }
      if (cleanUrl.includes('/register')) {
        return 'REGISTER';
      }
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    case 'GET':
      // Log important GET operations
      if (cleanUrl.includes('/export') || cleanUrl.includes('/download') ||
          cleanUrl.includes('/transcript') || cleanUrl.includes('/recording') ||
          cleanUrl.includes('/stats') || cleanUrl.includes('/analytics') ||
          cleanUrl.includes('/me') || cleanUrl.includes('/current') ||
          cleanUrl.includes('/profile')) {
        return 'READ';
      }
      return null; // Don't log regular list/view GET requests to avoid spam
    default:
      return null;
  }
};

// Helper function to extract record ID from URL
const extractRecordId = (url, method) => {
  const cleanUrl = url.split('?')[0];
  
  // Pattern: /api/entity/id
  const matches = cleanUrl.match(/\/api\/[^\/]+\/([^\/]+)$/);
  if (matches && matches[1] !== 'export' && matches[1] !== 'stats') {
    return matches[1];
  }
  
  return null;
};

// Helper function to get old values before update/delete
const getOldValues = async (tableName, recordId) => {
  if (!recordId || tableName === 'unknown') {
    return null;
  }

  try {
    // Map table names to their primary key columns
    const primaryKeyMapping = {
      'users': 'id',
      'roles': 'id',
      'contacts': 'id',
      'lists': 'id',
      'assistants': 'id',
      'outbound_calls': 'id',
      'models': 'id',
      'voices': 'id',
      'transcribers': 'id',
      'phone_numbers': 'id',
      'tools': 'id',
      'files': 'id',
      'knowledge_bases': 'id',
      'sessions': 'id',
      'chats': 'id',
      'squads': 'id',
      'workflows': 'id',
      'webhooks': 'id',
      'recordings': 'id',
      'permissions': 'id',
      'role_permissions': 'id',
      'page_permissions': 'id',
      'user_permissions': 'id',
      'user_roles': 'id',
      'role_page_permissions': 'id',
      'support_tickets': 'id',
      'dashboard': 'id',
      'vapi_calls': 'id',
      'facebook_integrations': 'id',
      'webhook_tests': 'id',
      'auth_sessions': 'id',
      'transcriber_voice_models': 'id',
      'campaigns': 'id',
      'email_verification_otps': 'id'
    };

    const primaryKey = primaryKeyMapping[tableName] || 'id';
    
    // Check if table exists and get old values
    // Note: Using template literals for table/column names since ?? doesn't work properly
    const sql = `SELECT * FROM \`${tableName}\` WHERE \`${primaryKey}\` = ? LIMIT 1`;
    const [rows] = await pool.execute(sql, [recordId]);
    
    return rows.length > 0 ? rows[0] : null;
  } catch (error) {
    console.error(`Error getting old values for ${tableName}:${recordId}:`, error);
    return null;
  }
};

// Helper function to compare old and new values
const getChangedFields = (oldValues, newValues) => {
  if (!oldValues || !newValues) {
    return null;
  }

  const changedFields = [];
  const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

  for (const key of allKeys) {
    if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
      changedFields.push({
        field: key,
        oldValue: oldValues[key],
        newValue: newValues[key]
      });
    }
  }

  return changedFields.length > 0 ? changedFields : null;
};

// Helper function to get real client IP address
const getRealClientIP = (req) => {
  // Check various headers for the real IP (common proxy headers)
  const forwarded = req.headers['x-forwarded-for'];
  const realIP = req.headers['x-real-ip'];
  const clientIP = req.headers['x-client-ip'];
  const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
  const trueClientIP = req.headers['true-client-ip']; // Akamai
  const xClusterClientIP = req.headers['x-cluster-client-ip'];

  // If behind a proxy, get the first IP from x-forwarded-for
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    const firstIP = ips[0];
    // Don't return localhost IPs from proxy headers
    if (firstIP && firstIP !== '127.0.0.1' && firstIP !== '::1' && firstIP !== 'localhost') {
      return firstIP;
    }
  }

  // Try other headers (prioritize real client IP headers)
  if (cfConnectingIP && cfConnectingIP !== '127.0.0.1' && cfConnectingIP !== '::1') return cfConnectingIP;
  if (trueClientIP && trueClientIP !== '127.0.0.1' && trueClientIP !== '::1') return trueClientIP;
  if (realIP && realIP !== '127.0.0.1' && realIP !== '::1') return realIP;
  if (clientIP && clientIP !== '127.0.0.1' && clientIP !== '::1') return clientIP;
  if (xClusterClientIP && xClusterClientIP !== '127.0.0.1' && xClusterClientIP !== '::1') return xClusterClientIP;

  // Try to get external IP if available
  const connectionIP = req.connection?.remoteAddress || req.socket?.remoteAddress || req.ip;

  // If we're getting localhost, try to get a more meaningful IP
  if (connectionIP === '::1' || connectionIP === '127.0.0.1' || connectionIP === 'localhost') {
    // For development/local testing, we can try to get the local network IP
    // But for now, let's return a more descriptive localhost identifier
    return '127.0.0.1 (localhost)';
  }

  return connectionIP || '127.0.0.1 (unknown)';
};

// Main audit middleware
const auditLogMiddleware = async (req, res, next) => {
  const startTime = Date.now();

  // Only skip non-essential endpoints to capture every important operation
  const skipPatterns = [
    '/api/audit-logs', // Skip audit log endpoints to prevent recursion
    '/swagger',
    '/favicon.ico',
    '/health',
    '/api-docs'
  ];

  // Check minimal skip patterns
  const shouldSkip = skipPatterns.some(pattern => req.url.includes(pattern));
  if (shouldSkip) {
    return next();
  }

  const operationType = getOperationType(req.method, req.url);
  if (!operationType) {
    return next();
  }

  const tableName = extractTableNameFromUrl(req.url, req.method);
  const recordId = extractRecordId(req.url, req.method);

  // Get old values for UPDATE and DELETE operations
  let oldValues = null;
  if ((operationType === 'UPDATE' || operationType === 'DELETE') && recordId) {
    oldValues = await getOldValues(tableName, recordId);
  }

  // Store original res.json to capture response
  const originalJson = res.json;
  let responseData = null;
  let responseStatus = null;

  res.json = function(data) {
    responseData = data;
    responseStatus = res.statusCode;
    return originalJson.call(this, data);
  };

  // Store original res.status to capture status
  const originalStatus = res.status;
  res.status = function(code) {
    responseStatus = code;
    return originalStatus.call(this, code);
  };

  // Continue with the request
  res.on('finish', async () => {
    try {
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Prepare audit log data
      const auditData = {
        user_id: req.user?.id || null,
        user_email: req.user?.email || null,
        user_name: req.user ? `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() : null,
        operation_type: operationType,
        table_name: tableName,
        record_id: recordId,
        old_values: oldValues,
        new_values: operationType === 'CREATE' ? req.body : 
                   operationType === 'UPDATE' ? req.body : 
                   operationType === 'DELETE' ? null : 
                   responseData,
        changed_fields: operationType === 'UPDATE' ? getChangedFields(oldValues, req.body) : null,
        ip_address: getRealClientIP(req),
        user_agent: req.headers['user-agent'],
        request_method: req.method,
        request_url: req.url,
        request_body: ['GET', 'DELETE'].includes(req.method) ? null : req.body,
        response_status: responseStatus || res.statusCode,
        execution_time_ms: executionTime,
        error_message: responseStatus >= 400 ? JSON.stringify(responseData) : null,
        metadata: {
          headers: {
            'content-type': req.headers['content-type'],
            'authorization': req.headers['authorization'] ? '[REDACTED]' : null
          },
          query: req.query,
          params: req.params
        },
        session_id: req.sessionID || uuidv4(),
        transaction_id: uuidv4()
      };

      // Create audit log entry
      await AuditLogModel.createAuditLog(auditData);
      
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Don't throw error to avoid breaking the main request
    }
  });

  next();
};

module.exports = auditLogMiddleware;
