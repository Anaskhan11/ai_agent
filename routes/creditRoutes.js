const express = require('express');
const router = express.Router();

// Import controllers
const CreditController = require('../controller/CreditController/CreditController');
const StripeWebhookController = require('../controller/CreditController/StripeWebhookController');

// Import middleware
const authMiddleware = require('../middleware/authMiddleware');
const { checkPermission, checkAnyPermission } = require('../middleware/permissionMiddleware');
const { attachCreditBalance, checkLowCredits } = require('../middleware/creditMiddleware');

// Apply auth middleware to all routes except webhooks
router.use('/stripe/webhook', express.raw({ type: 'application/json' }));
router.use((req, res, next) => {
  if (req.path.startsWith('/stripe/webhook')) {
    return next();
  }
  authMiddleware(req, res, next);
});

// Apply credit balance and low credit check to user routes
router.use((req, res, next) => {
  if (req.path.startsWith('/stripe/webhook') || req.path.startsWith('/admin')) {
    return next();
  }
  attachCreditBalance(req, res, next);
});

router.use((req, res, next) => {
  if (req.path.startsWith('/stripe/webhook') || req.path.startsWith('/admin')) {
    return next();
  }
  checkLowCredits(req, res, next);
});

// =============================================================================
// USER CREDIT ROUTES
// =============================================================================

/**
 * @route   GET /api/credits/balance
 * @desc    Get user credit balance
 * @access  Private
 */
router.get('/balance', CreditController.getCreditBalance);

/**
 * @route   GET /api/credits/packages
 * @desc    Get available credit packages
 * @access  Private
 */
router.get('/packages', CreditController.getCreditPackages);

/**
 * @route   GET /api/credits/packages/recommendations
 * @desc    Get personalized package recommendations
 * @access  Private
 */
router.get('/packages/recommendations', CreditController.getPackageRecommendations);

/**
 * @route   POST /api/credits/purchase
 * @desc    Create payment intent for credit purchase
 * @access  Private
 */
router.post('/purchase', CreditController.createPaymentIntent);

/**
 * @route   GET /api/credits/payment/:paymentIntentId/status
 * @desc    Get payment status
 * @access  Private
 */
router.get('/payment/:paymentIntentId/status', CreditController.getPaymentStatus);

/**
 * @route   GET /api/credits/transactions
 * @desc    Get user credit transactions
 * @access  Private
 */
router.get('/transactions', CreditController.getCreditTransactions);

/**
 * @route   GET /api/credits/payments
 * @desc    Get user payment history
 * @access  Private
 */
router.get('/payments', CreditController.getPaymentHistory);

/**
 * @route   GET /api/credits/usage/analytics
 * @desc    Get user usage analytics
 * @access  Private
 */
router.get('/usage/analytics', CreditController.getUsageAnalytics);

/**
 * @route   GET /api/credits/usage/history
 * @desc    Get detailed usage history
 * @access  Private
 */
router.get('/usage/history', CreditController.getUsageHistory);

/**
 * @route   GET /api/credits/payment-status/:paymentIntentId
 * @desc    Check payment status and ensure credits are allocated
 * @access  Private
 */
router.get('/payment-status/:paymentIntentId', CreditController.checkPaymentStatus);

/**
 * @route   GET /api/credits/expiration
 * @desc    Get user credit expiration details
 * @access  Private
 */
router.get('/expiration', CreditController.getCreditExpirationDetails);

/**
 * @route   GET /api/credits/alerts
 * @desc    Get user credit alerts and notifications
 * @access  Private
 */
router.get('/alerts', CreditController.getCreditAlerts);

// =============================================================================
// STRIPE WEBHOOK ROUTES
// =============================================================================

/**
 * @route   POST /api/credits/stripe/webhook
 * @desc    Handle Stripe webhooks
 * @access  Public (Stripe)
 */
router.post('/stripe/webhook', StripeWebhookController.handleStripeWebhook);

/**
 * @route   POST /api/credits/stripe/webhook/test
 * @desc    Test webhook processing (development only)
 * @access  Private (Admin)
 */
router.post('/stripe/webhook/test', 
  authMiddleware,
  checkPermission('manage_credits'),
  StripeWebhookController.testWebhook
);

// =============================================================================
// ADMIN CREDIT ROUTES
// =============================================================================

/**
 * @route   GET /api/credits/admin/users
 * @desc    Get all user credits (Admin)
 * @access  Private (Admin)
 */
router.get('/admin/users', 
  checkPermission('manage_credits'),
  CreditController.getAllUserCredits
);

/**
 * @route   POST /api/credits/admin/adjust
 * @desc    Adjust user credits (Admin)
 * @access  Private (Admin)
 */
router.post('/admin/adjust', 
  checkPermission('manage_credits'),
  CreditController.adjustUserCredits
);

/**
 * @route   GET /api/credits/admin/analytics
 * @desc    Get system credit analytics (Admin)
 * @access  Private (Admin)
 */
router.get('/admin/analytics',
  checkPermission('view_analytics'),
  CreditController.getCreditAnalytics
);

/**
 * @route   GET /api/credits/admin/users
 * @desc    Get all users with detailed credit information (Admin)
 * @access  Private (Admin)
 */
router.get('/admin/users',
  checkPermission('manage_credits'),
  CreditController.getAllUsersCredits
);

/**
 * @route   GET /api/credits/admin/transactions
 * @desc    Get all credit transactions across users (Admin)
 * @access  Private (Admin)
 */
router.get('/admin/transactions',
  checkPermission('view_analytics'),
  CreditController.getAllTransactions
);

/**
 * @route   GET /api/credits/admin/expiration-stats
 * @desc    Get system-wide credit expiration statistics (Admin)
 * @access  Private (Admin)
 */
router.get('/admin/expiration-stats',
  checkPermission('view_analytics'),
  CreditController.getExpirationStatistics
);

/**
 * @route   GET /api/credits/admin/webhooks/logs
 * @desc    Get webhook processing logs (Admin)
 * @access  Private (Admin)
 */
router.get('/admin/webhooks/logs', 
  checkPermission('view_system_logs'),
  StripeWebhookController.getWebhookLogs
);

/**
 * @route   POST /api/credits/admin/webhooks/:event_id/retry
 * @desc    Retry failed webhook processing (Admin)
 * @access  Private (Admin)
 */
router.post('/admin/webhooks/:event_id/retry', 
  checkPermission('manage_system'),
  StripeWebhookController.retryWebhook
);

// =============================================================================
// CREDIT PACKAGE MANAGEMENT ROUTES (Admin)
// =============================================================================

const CreditPackageModel = require('../model/CreditModel/CreditPackageModel');

/**
 * @route   POST /api/credits/admin/packages
 * @desc    Create new credit package (Admin)
 * @access  Private (Admin)
 */
router.post('/admin/packages', 
  checkPermission('manage_credits'),
  async (req, res) => {
    try {
      const result = await CreditPackageModel.createCreditPackage(req.body);
      res.json({
        success: true,
        data: result,
        message: 'Credit package created successfully'
      });
    } catch (error) {
      console.error('Error creating credit package:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create credit package',
        error: error.message
      });
    }
  }
);

/**
 * @route   PUT /api/credits/admin/packages/:packageId
 * @desc    Update credit package (Admin)
 * @access  Private (Admin)
 */
router.put('/admin/packages/:packageId', 
  checkPermission('manage_credits'),
  async (req, res) => {
    try {
      const { packageId } = req.params;
      const result = await CreditPackageModel.updateCreditPackage(packageId, req.body);
      
      if (!result.updated) {
        return res.status(404).json({
          success: false,
          message: 'Credit package not found'
        });
      }
      
      res.json({
        success: true,
        data: result,
        message: 'Credit package updated successfully'
      });
    } catch (error) {
      console.error('Error updating credit package:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update credit package',
        error: error.message
      });
    }
  }
);

/**
 * @route   DELETE /api/credits/admin/packages/:packageId
 * @desc    Delete credit package (Admin)
 * @access  Private (Admin)
 */
router.delete('/admin/packages/:packageId', 
  checkPermission('manage_credits'),
  async (req, res) => {
    try {
      const { packageId } = req.params;
      const { hardDelete = false } = req.query;
      
      const result = await CreditPackageModel.deleteCreditPackage(packageId, hardDelete === 'true');
      
      if (!result.deleted) {
        return res.status(404).json({
          success: false,
          message: 'Credit package not found'
        });
      }
      
      res.json({
        success: true,
        data: result,
        message: hardDelete ? 'Credit package deleted permanently' : 'Credit package deactivated'
      });
    } catch (error) {
      console.error('Error deleting credit package:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete credit package',
        error: error.message
      });
    }
  }
);

/**
 * @route   GET /api/credits/admin/packages/stats
 * @desc    Get package purchase statistics (Admin)
 * @access  Private (Admin)
 */
router.get('/admin/packages/stats', 
  checkPermission('view_analytics'),
  async (req, res) => {
    try {
      const { packageId, days = 30 } = req.query;
      const stats = await CreditPackageModel.getPackagePurchaseStats(packageId, parseInt(days));
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error getting package stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get package statistics',
        error: error.message
      });
    }
  }
);

module.exports = router;
