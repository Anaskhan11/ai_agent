const CreditModel = require('../../model/CreditModel/CreditModel');
const CreditPackageModel = require('../../model/CreditModel/CreditPackageModel');
const StripePaymentModel = require('../../model/CreditModel/StripePaymentModel');
const UsageTrackingModel = require('../../model/CreditModel/UsageTrackingModel');
const StripeService = require('../../services/StripeService');
const CreditExpirationService = require('../../services/CreditExpirationService');
const CreditNotificationService = require('../../services/CreditNotificationService');
const { isSuperAdmin } = require('../../middleware/creditMiddleware');

// Helper function to validate and convert user ID
const validateUserId = (req) => {
  const rawUserId = req.user?.id;
  const userId = parseInt(rawUserId);

  if (isNaN(userId) || userId <= 0) {
    throw new Error(`Invalid user ID: ${rawUserId} -> ${userId}`);
  }

  return userId;
};

// Get user credit balance
const getCreditBalance = async (req, res) => {
  try {
    // Validate and get user ID
    let userId;
    try {
      userId = validateUserId(req);
    } catch (validationError) {
      console.error(`❌ User ID validation failed:`, validationError.message);
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
        error: 'INVALID_USER_ID'
      });
    }

    console.log(`🔍 Getting credit balance for user ID: ${userId}`);
    console.log(`🔍 User object:`, { id: req.user.id, username: req.user.username, email: req.user.email });

    // Check if super admin
    if (await isSuperAdmin(userId)) {
      return res.json({
        success: true,
        data: {
          isSuperAdmin: true,
          unlimited: true,
          total_credits: 'unlimited',
          used_credits: 0,
          available_credits: 'unlimited',
          last_purchase_at: null,
          last_usage_at: null
        }
      });
    }

    const balance = await CreditModel.getUserCreditBalance(userId);

    if (!balance) {
      try {
        // Initialize credits for new user
        console.log(`🔄 Initializing credits for user ID: ${userId}`);
        await CreditModel.initializeUserCredits(userId, 0);
        const newBalance = await CreditModel.getUserCreditBalance(userId);

        return res.json({
          success: true,
          data: {
            ...newBalance,
            expiration_info: {
              has_expiring_credits: false,
              credits_expiring_soon: 0,
              earliest_expiry: null
            }
          }
        });
      } catch (initError) {
        console.error(`❌ Failed to initialize credits for user ${userId}:`, initError);

        // Check if it's a foreign key constraint error
        if (initError.message.includes('does not exist')) {
          return res.status(400).json({
            success: false,
            message: 'User account not found. Please ensure you are properly logged in.',
            error: 'USER_NOT_FOUND'
          });
        }

        // Re-throw other errors to be caught by the outer try-catch
        throw initError;
      }
    }

    // Get expiration summary
    try {
      const expirationSummary = await CreditExpirationService.getUserExpirationSummary(userId);

      res.json({
        success: true,
        data: {
          ...balance,
          expiration_info: {
            has_expiring_credits: expirationSummary.expiring_soon_batches > 0,
            credits_expiring_soon: expirationSummary.credits_expiring_soon,
            earliest_expiry: expirationSummary.batches.expiring_soon[0]?.expiry_date || null,
            active_batches: expirationSummary.active_batches,
            expired_batches: expirationSummary.recent_expired_batches
          }
        }
      });
    } catch (expirationError) {
      console.warn('Failed to get expiration info:', expirationError);
      // Return basic balance without expiration info
      res.json({
        success: true,
        data: balance
      });
    }
  } catch (error) {
    console.error('Error getting credit balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit balance',
      error: error.message
    });
  }
};

// Get available credit packages
const getCreditPackages = async (req, res) => {
  try {
    const userId = req.user?.id;
    const packages = await CreditPackageModel.getAllCreditPackages();

    // Check if user is eligible for free trial
    let isEligibleForFreeTrial = false;
    if (userId) {
      try {
        const pool = require('../../config/DBConnection');

        // Check if user has already claimed free trial
        const [userCheck] = await pool.execute(
          `SELECT free_trial_claimed FROM users WHERE id = ?`,
          [userId]
        );

        isEligibleForFreeTrial = userCheck.length > 0 && !userCheck[0].free_trial_claimed;
      } catch (error) {
        console.error('Error checking free trial eligibility:', error);
        // If error checking, assume not eligible to be safe
        isEligibleForFreeTrial = false;
      }
    }

    // Filter and modify packages based on eligibility
    let finalPackages = packages.filter(pkg => {
      // Show all active packages
      return pkg.is_active;
    });

    // Calculate total credits and price for each package, with special handling for Starter Pack
    finalPackages = finalPackages.map(pkg => {
      const basePackage = {
        ...pkg,
        total_credits: pkg.credits_amount + (pkg.bonus_credits || 0),
        price_dollars: pkg.price_cents / 100
      };

      // Special handling for Starter Pack - make it free for eligible users
      if (pkg.package_id === 'starter' && isEligibleForFreeTrial) {
        return {
          ...basePackage,
          price_dollars: 0,
          original_price_dollars: pkg.price_cents / 100,
          is_free_trial: true,
          name: 'Starter Pack - FREE Trial',
          description: 'Perfect for getting started with voice AI. One-time free offer for new users. Card required for verification.'
        };
      }

      return basePackage;
    });

    res.json({
      success: true,
      data: finalPackages
    });
  } catch (error) {
    console.error('Error getting credit packages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit packages',
      error: error.message
    });
  }
};

// Get package recommendations for user
const getPackageRecommendations = async (req, res) => {
  try {
    const userId = req.user.id;
    const recommendations = await CreditPackageModel.getPackageRecommendations(userId);
    
    res.json({
      success: true,
      data: recommendations
    });
  } catch (error) {
    console.error('Error getting package recommendations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get package recommendations',
      error: error.message
    });
  }
};

// Create payment intent for credit purchase
const createPaymentIntent = async (req, res) => {
  try {
    const userId = validateUserId(req);
    const {
      packageId,
      isFreeTrial = false,
      autoSubscriptionEnabled = false,
      autoSubscriptionPackage = 'professional'
    } = req.body;

    if (!packageId) {
      return res.status(400).json({
        success: false,
        message: 'Package ID is required'
      });
    }

    // Check if Stripe is configured
    if (!StripeService.isStripeAvailable()) {
      return res.status(503).json({
        success: false,
        message: 'Payment processing is currently unavailable. Please contact support.',
        error_code: 'STRIPE_NOT_CONFIGURED'
      });
    }

    // Prepare options for StripeService
    const options = {
      isFreeTrial,
      autoSubscriptionEnabled,
      autoSubscriptionPackage
    };

    const result = await StripeService.createPaymentIntent(userId, packageId, req.user, options);

    // Handle different response types (payment intent vs setup intent)
    const responseData = {
      package: result.creditPackage
    };

    if (result.paymentIntent) {
      // Regular payment intent
      responseData.client_secret = result.paymentIntent.client_secret;
      responseData.payment_intent_id = result.paymentIntent.id;
      responseData.amount = result.paymentIntent.amount;
      responseData.currency = result.paymentIntent.currency;
    } else if (result.setupIntent) {
      // Free trial setup intent
      responseData.client_secret = result.setupIntent.client_secret;
      responseData.setup_intent_id = result.setupIntent.id;
      responseData.amount = 0;
      responseData.currency = 'usd';
      responseData.is_free_trial = true;
    }

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create payment intent',
      error: error.message
    });
  }
};

// Get payment status
const getPaymentStatus = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const status = await StripeService.getPaymentStatus(paymentIntentId);
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment status',
      error: error.message
    });
  }
};

// Get user credit transactions
const getCreditTransactions = async (req, res) => {
  try {
    const userId = validateUserId(req);
    const { page = 1, limit = 20, type } = req.query;
    
    const transactions = await CreditModel.getUserCreditTransactions(
      userId, 
      parseInt(page), 
      parseInt(limit), 
      type
    );
    
    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    console.error('Error getting credit transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit transactions',
      error: error.message
    });
  }
};

// Get user payment history
const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status } = req.query;
    
    const payments = await StripePaymentModel.getUserPaymentHistory(
      userId, 
      parseInt(page), 
      parseInt(limit), 
      status
    );
    
    res.json({
      success: true,
      data: payments
    });
  } catch (error) {
    console.error('Error getting payment history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get payment history',
      error: error.message
    });
  }
};

// Get user usage analytics
const getUsageAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
    const { days = 30 } = req.query;
    
    const analytics = await CreditModel.getUserCreditAnalytics(userId, parseInt(days));
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error getting usage analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage analytics',
      error: error.message
    });
  }
};

// Get detailed usage history
const getUsageHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, operationType, status } = req.query;
    
    const usage = await UsageTrackingModel.getUserUsageHistory(
      userId, 
      parseInt(page), 
      parseInt(limit), 
      operationType, 
      status
    );
    
    res.json({
      success: true,
      data: usage
    });
  } catch (error) {
    console.error('Error getting usage history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get usage history',
      error: error.message
    });
  }
};

// Admin: Get all user credits
const getAllUserCredits = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const pool = require('../../config/DBConnection');
    const [rows] = await pool.execute(`
      SELECT 
        uc.*,
        u.email,
        u.first_name,
        u.last_name,
        u.username
      FROM user_credits uc
      JOIN users u ON uc.user_id = u.id
      ORDER BY uc.available_credits ASC, uc.last_usage_at DESC
      LIMIT ? OFFSET ?
    `, [parseInt(limit), offset]);

    const [countRows] = await pool.execute('SELECT COUNT(*) as total FROM user_credits');
    const total = countRows[0].total;

    res.json({
      success: true,
      data: {
        users: rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting all user credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user credits',
      error: error.message
    });
  }
};

// Admin: Adjust user credits
const adjustUserCredits = async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    const adminUserId = req.user.id;

    if (!userId || amount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User ID and amount are required'
      });
    }

    const result = await CreditModel.adjustUserCredits(
      userId, 
      parseFloat(amount), 
      adminUserId, 
      reason || 'Admin adjustment'
    );
    
    res.json({
      success: true,
      data: result,
      message: `Credits ${amount > 0 ? 'added to' : 'deducted from'} user account`
    });
  } catch (error) {
    console.error('Error adjusting user credits:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to adjust user credits',
      error: error.message
    });
  }
};

// Admin: Get system credit analytics
const getSystemAnalytics = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const [usageAnalytics, paymentAnalytics] = await Promise.all([
      UsageTrackingModel.getSystemUsageAnalytics(parseInt(days)),
      StripePaymentModel.getPaymentAnalytics(parseInt(days))
    ]);
    
    res.json({
      success: true,
      data: {
        usage: usageAnalytics,
        payments: paymentAnalytics,
        period: `${days} days`
      }
    });
  } catch (error) {
    console.error('Error getting system analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get system analytics',
      error: error.message
    });
  }
};

// Admin: Get all users with detailed credit information
const getAllUsersCredits = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const pool = require('../../config/DBConnection');
    const [users] = await pool.execute(`
      SELECT
        u.user_id,
        u.email,
        u.first_name,
        u.last_name,
        u.username,
        u.role,
        COALESCE(uc.total_credits, 0) as total_credits,
        COALESCE(uc.used_credits, 0) as used_credits,
        COALESCE(uc.available_credits, 0) as available_credits,
        uc.last_updated,
        sp.created_at as last_purchase_at
      FROM users u
      LEFT JOIN user_credits uc ON u.user_id = uc.user_id
      LEFT JOIN (
        SELECT user_id, MAX(created_at) as created_at
        FROM stripe_payments
        WHERE status = 'succeeded'
        GROUP BY user_id
      ) sp ON u.user_id = sp.user_id
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);

    // Get total count
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM users');
    const total = countResult[0].total;

    res.json({
      status: true,
      message: 'Users credit information retrieved successfully',
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting users credits:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve users credit information',
      error: error.message
    });
  }
};

// Admin: Get comprehensive credit analytics
const getCreditAnalytics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const pool = require('../../config/DBConnection');

    // Usage analytics
    const [usageStats] = await pool.execute(`
      SELECT
        COUNT(*) as total_operations,
        COALESCE(SUM(credits_consumed), 0) as total_credits_consumed,
        COALESCE(AVG(credits_consumed), 0) as avg_credits_per_operation,
        COUNT(DISTINCT user_id) as active_users
      FROM usage_tracking
      WHERE created_at >= ?
    `, [startDate]);

    // Payment analytics
    const [paymentStats] = await pool.execute(`
      SELECT
        COUNT(*) as total_payments,
        SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as successful_payments,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN amount_cents ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'succeeded' THEN credits_amount ELSE 0 END), 0) as total_credits_sold
      FROM stripe_payments
      WHERE created_at >= ?
    `, [startDate]);

    // Top operations by credit consumption
    const [topOperations] = await pool.execute(`
      SELECT
        operation_type,
        COUNT(*) as operation_count,
        SUM(credits_consumed) as total_credits,
        AVG(credits_consumed) as avg_credits
      FROM usage_tracking
      WHERE created_at >= ?
      GROUP BY operation_type
      ORDER BY total_credits DESC
      LIMIT 10
    `, [startDate]);

    res.json({
      status: true,
      message: 'Credit analytics retrieved successfully',
      data: {
        usage: usageStats[0],
        payments: paymentStats[0],
        topOperations,
        period: {
          days,
          startDate,
          endDate: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Error getting credit analytics:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve credit analytics',
      error: error.message
    });
  }
};

// Admin: Get all transactions across users
const getAllTransactions = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const type = req.query.type;

    const pool = require('../../config/DBConnection');

    let sql = `
      SELECT
        ct.transaction_id,
        ct.user_id,
        u.email,
        u.first_name,
        u.last_name,
        ct.type,
        ct.amount,
        ct.balance_before,
        ct.balance_after,
        ct.description,
        ct.reference_type,
        ct.reference_id,
        ct.created_at
      FROM credit_transactions ct
      JOIN users u ON ct.user_id = u.user_id
    `;

    const params = [];

    if (type) {
      sql += ' WHERE ct.type = ?';
      params.push(type);
    }

    sql += ' ORDER BY ct.created_at DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const [transactions] = await pool.execute(sql, params);

    // Get total count
    let countSql = 'SELECT COUNT(*) as total FROM credit_transactions ct';
    const countParams = [];
    if (type) {
      countSql += ' WHERE type = ?';
      countParams.push(type);
    }

    const [countResult] = await pool.execute(countSql, countParams);
    const total = countResult[0].total;

    res.json({
      status: true,
      message: 'Transactions retrieved successfully',
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({
      status: false,
      message: 'Failed to retrieve transactions',
      error: error.message
    });
  }
};

// Check payment status and ensure credits are allocated
const checkPaymentStatus = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const userId = req.user.id;

    const StripePaymentModel = require('../../model/CreditModel/StripePaymentModel');
    const StripeService = require('../../services/StripeService');

    // Check if payment exists and credits are allocated
    const payment = await StripePaymentModel.getStripePaymentByIntentId(paymentIntentId);

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    if (payment.user_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to payment'
      });
    }

    // If credits not allocated yet, try to allocate them
    if (!payment.credits_allocated) {
      try {
        await StripeService.handleSuccessfulPayment(paymentIntentId);
      } catch (error) {
        console.error('Error allocating credits:', error);
      }
    }

    res.json({
      success: true,
      data: {
        payment_intent_id: payment.payment_intent_id,
        credits_allocated: payment.credits_allocated,
        credits_purchased: payment.credits_purchased,
        amount: payment.amount,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
};

// Get user credit expiration details
const getCreditExpirationDetails = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if super admin
    if (await isSuperAdmin(userId)) {
      return res.json({
        success: true,
        data: {
          isSuperAdmin: true,
          unlimited: true,
          message: 'Super admin has unlimited credits with no expiration'
        }
      });
    }

    const expirationSummary = await CreditExpirationService.getUserExpirationSummary(userId);

    res.json({
      success: true,
      data: expirationSummary
    });
  } catch (error) {
    console.error('Error getting credit expiration details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit expiration details',
      error: error.message
    });
  }
};

// Admin: Get system expiration statistics
const getExpirationStatistics = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const stats = await CreditExpirationService.getExpirationStatistics(days);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting expiration statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get expiration statistics',
      error: error.message
    });
  }
};

// Get user credit alerts
const getCreditAlerts = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 10;
    const alertType = req.query.type || null;

    // Check if super admin
    if (await isSuperAdmin(userId)) {
      return res.json({
        success: true,
        data: {
          isSuperAdmin: true,
          alerts: [],
          message: 'Super admin has no credit alerts'
        }
      });
    }

    const alerts = await CreditNotificationService.getUserAlerts(userId, limit, alertType);

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length
      }
    });
  } catch (error) {
    console.error('Error getting credit alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get credit alerts',
      error: error.message
    });
  }
};

module.exports = {
  getCreditBalance,
  getCreditPackages,
  getPackageRecommendations,
  createPaymentIntent,
  getPaymentStatus,
  getCreditTransactions,
  getPaymentHistory,
  getUsageAnalytics,
  getUsageHistory,
  getAllUserCredits,
  adjustUserCredits,
  getSystemAnalytics,
  getAllUsersCredits,
  getCreditAnalytics,
  getAllTransactions,
  checkPaymentStatus,
  getCreditExpirationDetails,
  getExpirationStatistics,
  getCreditAlerts
};
