/**
 * Authentication Audit Logger
 * Handles logging of all authentication-related operations
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

// Log authentication operations
const logAuthOperation = async (req, operationType, userData = null, additionalData = {}) => {
  try {
    const startTime = Date.now();
    const { browser, engine } = getBrowserInfo(req.headers['user-agent']);
    
    const auditData = {
      user_id: userData?.id || null,
      user_email: userData?.email || req.body?.email || null,
      user_name: userData ? `${userData.first_name || ''} ${userData.last_name || ''}`.trim() : null,
      operation_type: operationType,
      table_name: 'auth_sessions',
      record_id: userData?.id || req.body?.email || 'N/A',
      old_values: additionalData.oldValues || null,
      new_values: additionalData.newValues || req.body || null,
      changed_fields: additionalData.changedFields || null,
      ip_address: getRealClientIP(req),
      user_agent: req.headers['user-agent'],
      request_method: req.method,
      request_url: req.url,
      request_body: operationType === 'LOGIN' ? { email: req.body?.email } : req.body, // Don't log passwords
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
        auth_details: {
          operation_type: operationType,
          success: additionalData.success !== false,
          failure_reason: additionalData.failureReason || null
        }
      },
      session_id: req.sessionID || uuidv4(),
      transaction_id: uuidv4()
    };

    // Create audit log entry
    await AuditLogModel.createAuditLog(auditData);
    console.log(`✅ Auth audit log created: ${operationType} for ${userData?.email || req.body?.email || 'Unknown'}`);
    
  } catch (error) {
    console.error('Error creating auth audit log:', error);
    // Don't throw error to avoid breaking the main request
  }
};

// Specific logging functions for different auth operations
const logLogin = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'LOGIN', userData, {
    success,
    failureReason,
    responseStatus: success ? 200 : 401,
    errorMessage: failureReason
  });
};

const logLogout = async (req, userData) => {
  await logAuthOperation(req, 'LOGOUT', userData, {
    success: true,
    responseStatus: 200
  });
};

const logRegister = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'REGISTER', userData, {
    success,
    failureReason,
    responseStatus: success ? 201 : 400,
    errorMessage: failureReason,
    newValues: {
      email: req.body?.email,
      username: req.body?.username,
      first_name: req.body?.first_name,
      last_name: req.body?.last_name
    }
  });
};

const logOTPVerification = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'VERIFY_OTP', userData, {
    success,
    failureReason,
    responseStatus: success ? 200 : 400,
    errorMessage: failureReason,
    newValues: {
      email: req.body?.email,
      otp_verified: success
    }
  });
};

const logOTPResend = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'RESEND_OTP', userData, {
    success,
    failureReason,
    responseStatus: success ? 200 : 400,
    errorMessage: failureReason,
    newValues: {
      email: req.body?.email,
      otp_resent: success
    }
  });
};

const logPasswordChange = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'PASSWORD_CHANGE', userData, {
    success,
    failureReason,
    responseStatus: success ? 200 : 400,
    errorMessage: failureReason,
    oldValues: { password_changed: false },
    newValues: { password_changed: success }
  });
};

const logPasswordReset = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'PASSWORD_RESET', userData, {
    success,
    failureReason,
    responseStatus: success ? 200 : 400,
    errorMessage: failureReason,
    newValues: {
      email: req.body?.email,
      password_reset: success
    }
  });
};

const logAccountActivation = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'ACCOUNT_ACTIVATION', userData, {
    success,
    failureReason,
    responseStatus: success ? 200 : 400,
    errorMessage: failureReason,
    oldValues: { is_active: false },
    newValues: { is_active: success }
  });
};

const logAccountDeactivation = async (req, userData, success = true, failureReason = null) => {
  await logAuthOperation(req, 'ACCOUNT_DEACTIVATION', userData, {
    success,
    failureReason,
    responseStatus: success ? 200 : 400,
    errorMessage: failureReason,
    oldValues: { is_active: true },
    newValues: { is_active: false }
  });
};

const logSessionExpiry = async (req, userData) => {
  await logAuthOperation(req, 'SESSION_EXPIRED', userData, {
    success: true,
    responseStatus: 401,
    errorMessage: 'Session expired'
  });
};

module.exports = {
  logAuthOperation,
  logLogin,
  logLogout,
  logRegister,
  logOTPVerification,
  logOTPResend,
  logPasswordChange,
  logPasswordReset,
  logAccountActivation,
  logAccountDeactivation,
  logSessionExpiry,
  getRealClientIP,
  getBrowserInfo
};
