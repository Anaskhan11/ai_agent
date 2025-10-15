const express = require("express");
const dashboardController = require("../../controller/dashboardController/DashboardController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();


router.get("/data", authMiddleware, dashboardController.getDashboardData);

router.post("/cache/clear", authMiddleware, dashboardController.clearDashboardCache);

router.delete("/cache/invalidate/:userId", authMiddleware, dashboardController.invalidateUserCache);

module.exports = router;
