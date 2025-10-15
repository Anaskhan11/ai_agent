const express = require("express");
const analyticsController = require("../../controller/AnalyticsController/AnalyticsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Create analytics query
router.post("/query", authMiddleware, analyticsController.createAnalyticsQuery);

// Get call analytics
router.get("/calls", authMiddleware, analyticsController.getCallAnalytics);

// Get cost analytics
router.get("/costs", authMiddleware, analyticsController.getCostAnalytics);

// Get performance analytics
router.get("/performance", authMiddleware, analyticsController.getPerformanceAnalytics);

// Get usage analytics
router.get("/usage", authMiddleware, analyticsController.getUsageAnalytics);

// Get comprehensive dashboard analytics
router.get("/dashboard", authMiddleware, analyticsController.getDashboardAnalytics);

// Get real-time dashboard metrics
router.get("/dashboard/realtime", authMiddleware, analyticsController.getRealTimeDashboardMetrics);

module.exports = router;
