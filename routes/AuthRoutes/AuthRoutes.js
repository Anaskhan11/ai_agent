const express = require("express");
const authController = require("../../controller/AuthController/AuthController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// Demo login (no auth required)
router.post("/demo-login", authController.demoLogin);

// Get current user (auth required)
router.get("/me", authMiddleware, authController.getCurrentUser);

// Password change route (auth required)
router.post("/change-password", authMiddleware, authController.changePassword);

// Facebook OAuth routes
router.get("/facebook/oauth-url", authMiddleware, authController.startFacebookOAuth);
router.get("/facebook/callback", authController.facebookOAuthCallback); // public callback
router.post("/facebook/connect", authMiddleware, authController.facebookAuth); // legacy exchange via code in body
router.get("/facebook/status", authMiddleware, authController.getFacebookStatus);
router.delete("/facebook/disconnect", authMiddleware, authController.disconnectFacebook);

module.exports = router;
