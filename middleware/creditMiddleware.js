const CreditModel = require('../model/CreditModel/CreditModel');
const UsageTrackingModel = require('../model/CreditModel/UsageTrackingModel');
const pool = require('../config/DBConnection');

// Check if user is super admin (bypass credit checks)
const isSuperAdmin = async (userId) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 1 FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id = ? 
        AND (u.role_id = 1 OR r.name = 'super_admin' OR u.is_super_admin = 1)
        AND u.is_active = 1
      LIMIT 1
    `, [userId]);
    
    return rows.length > 0;
  } catch (error) {
    console.error('Error checking super admin status:', error);
    return false;
  }
};

// Get credit cost for operation
const getCreditCost = async (operationType, unitType = 'per_operation') => {
  try {
    const [rows] = await pool.execute(`
      SELECT credits_per_unit 
      FROM credit_pricing 
      WHERE operation_type = ? 
        AND unit_type = ? 
        AND is_active = TRUE
        AND (effective_until IS NULL OR effective_until > NOW())
      ORDER BY effective_from DESC 
      LIMIT 1
    `, [operationType, unitType]);
    
    return rows[0]?.credits_per_unit || 0;
  } catch (error) {
    console.error('Error getting credit cost:', error);
    return 0;
  }
};

// Middleware to check credit availability before operation
const checkCredits = (operationType, unitType = 'per_operation', unitsRequired = 1) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user is super admin (bypass credit checks)
      if (await isSuperAdmin(userId)) {
        req.creditInfo = {
          isSuperAdmin: true,
          creditsRequired: 0,
          bypassCredits: true
        };
        return next();
      }

      // Get credit cost for this operation
      const creditCostPerUnit = await getCreditCost(operationType, unitType);
      const totalCreditsRequired = creditCostPerUnit * unitsRequired;

      // Check if user has sufficient credits
      const hasSufficientCredits = await CreditModel.checkSufficientCredits(userId, totalCreditsRequired);
      
      if (!hasSufficientCredits) {
        const balance = await CreditModel.getUserCreditBalance(userId);
        const availableCredits = balance?.available_credits || 0;
        
        return res.status(402).json({
          success: false,
          message: 'Insufficient credits',
          error_code: 'INSUFFICIENT_CREDITS',
          details: {
            required_credits: totalCreditsRequired,
            available_credits: availableCredits,
            operation_type: operationType,
            unit_type: unitType,
            units_required: unitsRequired
          },
          actions: {
            purchase_credits: '/api/credits/packages',
            current_balance: '/api/credits/balance'
          }
        });
      }

      // Attach credit info to request for later use
      req.creditInfo = {
        isSuperAdmin: false,
        creditsRequired: totalCreditsRequired,
        creditCostPerUnit: creditCostPerUnit,
        unitsRequired: unitsRequired,
        operationType: operationType,
        unitType: unitType,
        bypassCredits: false
      };

      next();
    } catch (error) {
      console.error('Credit check middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking credit availability',
        error: error.message
      });
    }
  };
};

// Middleware to deduct credits after successful operation
const deductCredits = (operationIdField = 'id', customUnits = null) => {
  return async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json;
    
    res.json = function(data) {
      // Call original res.json first
      originalJson.call(this, data);
      
      // Then handle credit deduction asynchronously
      handleCreditDeduction(req, data, operationIdField, customUnits);
    };
    
    next();
  };
};

// Handle credit deduction logic
const handleCreditDeduction = async (req, responseData, operationIdField, customUnits) => {
  try {
    const userId = req.user?.id;
    const creditInfo = req.creditInfo;
    
    if (!userId || !creditInfo || creditInfo.bypassCredits) {
      return; // Skip deduction for super admins or if no credit info
    }

    // Only deduct credits if the operation was successful
    if (!responseData?.success) {
      return;
    }

    // Calculate actual units used (if different from estimated)
    let actualUnits = customUnits || creditInfo.unitsRequired;
    let actualCredits = creditInfo.creditsRequired;
    
    // For dynamic operations (like calls), recalculate based on actual usage
    if (customUnits !== null) {
      actualCredits = creditInfo.creditCostPerUnit * actualUnits;
    }

    // Get operation ID from response data
    const operationId = responseData?.data?.[operationIdField] || 
                       responseData?.[operationIdField] || 
                       req.body?.[operationIdField] ||
                       null;

    // Deduct credits from user account
    const deductionResult = await CreditModel.deductCreditsFromUser(
      userId,
      actualCredits,
      creditInfo.operationType,
      operationId,
      `${creditInfo.operationType} operation`,
      {
        units_consumed: actualUnits,
        unit_type: creditInfo.unitType,
        unit_cost: creditInfo.creditCostPerUnit,
        request_path: req.path,
        request_method: req.method
      }
    );

    // Create usage tracking record
    await UsageTrackingModel.createUsageRecord({
      user_id: userId,
      operation_type: creditInfo.operationType,
      operation_id: operationId,
      credits_consumed: actualCredits,
      unit_cost: creditInfo.creditCostPerUnit,
      units_consumed: actualUnits,
      unit_type: creditInfo.unitType,
      operation_details: {
        endpoint: req.path,
        method: req.method,
        user_agent: req.headers['user-agent'],
        ip_address: req.ip
      },
      status: 'completed'
    });

    console.log(`Credits deducted: ${actualCredits} credits from user ${userId} for ${creditInfo.operationType}`);
    
  } catch (error) {
    console.error('Error deducting credits:', error);
    // Don't throw error to avoid breaking the response
    // Log for monitoring and alerting
  }
};

// Middleware for VAPI calls with dynamic duration
const checkVAPICallCredits = () => {
  return checkCredits('vapi_call', 'per_call', 1); // Initial check for call initiation
};

// Deduct VAPI call credits based on actual duration
const deductVAPICallCredits = (callDurationMinutes) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const creditInfo = req.creditInfo;
      
      if (!userId || !creditInfo || creditInfo.bypassCredits) {
        return next();
      }

      // Get per-minute cost
      const perMinuteCost = await getCreditCost('vapi_call', 'per_minute');
      const totalCredits = (creditInfo.creditsRequired) + (callDurationMinutes * perMinuteCost);
      
      // Deduct total credits (initiation + duration)
      await CreditModel.deductCreditsFromUser(
        userId,
        totalCredits,
        'vapi_call',
        req.body?.callId || null,
        `VAPI call: ${callDurationMinutes} minutes`,
        {
          duration_minutes: callDurationMinutes,
          initiation_cost: creditInfo.creditsRequired,
          duration_cost: callDurationMinutes * perMinuteCost,
          per_minute_cost: perMinuteCost
        }
      );

      // Track usage
      await UsageTrackingModel.trackVAPICallUsage(
        userId,
        req.body?.callId || null,
        callDurationMinutes,
        {
          endpoint: req.path,
          total_credits: totalCredits,
          initiation_credits: creditInfo.creditsRequired,
          duration_credits: callDurationMinutes * perMinuteCost
        }
      );

      next();
    } catch (error) {
      console.error('Error deducting VAPI call credits:', error);
      next(); // Continue even if credit deduction fails
    }
  };
};

// Get user credit balance (utility function for routes)
const getUserBalance = async (userId) => {
  try {
    if (await isSuperAdmin(userId)) {
      return {
        isSuperAdmin: true,
        unlimited: true,
        available_credits: 'unlimited'
      };
    }
    
    return await CreditModel.getUserCreditBalance(userId);
  } catch (error) {
    console.error('Error getting user balance:', error);
    return null;
  }
};

// Middleware to add credit balance to response
const attachCreditBalance = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (userId) {
      const balance = await getUserBalance(userId);
      req.userCreditBalance = balance;
    }
    next();
  } catch (error) {
    console.error('Error attaching credit balance:', error);
    next(); // Continue even if balance fetch fails
  }
};

// Credit alert middleware - check for low credits
const checkLowCredits = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId || await isSuperAdmin(userId)) {
      return next();
    }

    const balance = await CreditModel.getUserCreditBalance(userId);
    if (balance && balance.available_credits <= 10) { // Default threshold
      // Add low credit warning to response headers
      res.set('X-Credit-Warning', 'low');
      res.set('X-Available-Credits', balance.available_credits.toString());
    }

    next();
  } catch (error) {
    console.error('Error checking low credits:', error);
    next();
  }
};

// Middleware to block all functionality when user has zero credits
const blockZeroCredits = (exemptPaths = []) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      // Check if user is super admin (bypass credit checks)
      if (await isSuperAdmin(userId)) {
        return next();
      }

      // Check if current path is exempt from credit blocking
      const currentPath = req.path;
      const fullPath = req.originalUrl || req.url;

      console.log(`🔍 [blockZeroCredits] Checking path exemption:`, {
        currentPath,
        fullPath,
        exemptPaths: exemptPaths.slice(0, 5) // Log first 5 for debugging
      });

      const isExempt = exemptPaths.some(exemptPath => {
        if (typeof exemptPath === 'string') {
          const pathMatches = currentPath.startsWith(exemptPath);
          const fullPathMatches = fullPath.startsWith(exemptPath);
          console.log(`🔍 [blockZeroCredits] Checking "${exemptPath}": path=${pathMatches}, fullPath=${fullPathMatches}`);
          return pathMatches || fullPathMatches;
        }
        if (exemptPath instanceof RegExp) {
          return exemptPath.test(currentPath) || exemptPath.test(fullPath);
        }
        return false;
      });

      if (isExempt) {
        return next();
      }

      // Get user credit balance
      const balance = await CreditModel.getUserCreditBalance(userId);

      if (!balance || balance.available_credits <= 0) {
        return res.status(402).json({
          success: false,
          message: 'No credits available. Please purchase credits to continue using the service.',
          error_code: 'NO_CREDITS_AVAILABLE',
          details: {
            available_credits: balance?.available_credits || 0,
            total_credits: balance?.total_credits || 0,
            used_credits: balance?.used_credits || 0
          },
          actions: {
            purchase_credits: '/api/credits/packages',
            current_balance: '/api/credits/balance',
            payment_history: '/api/credits/payments'
          },
          ui_actions: {
            redirect_to: '/credits/purchase',
            show_purchase_modal: true
          }
        });
      }

      next();
    } catch (error) {
      console.error('Error in zero credit blocking middleware:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking credit availability',
        error: error.message
      });
    }
  };
};

module.exports = {
  checkCredits,
  deductCredits,
  checkVAPICallCredits,
  deductVAPICallCredits,
  getUserBalance,
  attachCreditBalance,
  checkLowCredits,
  blockZeroCredits,
  isSuperAdmin,
  getCreditCost
};
