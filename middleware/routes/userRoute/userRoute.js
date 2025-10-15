// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const userController = require("../../controller/userController/userController");
const authMiddleware = require("../../middleware/authMiddleware");


router.post("/register", userController.register);

// OTP verification routes
router.post("/verify-otp", userController.verifyOTP);
router.post("/resend-otp", userController.resendOTP);

router.post("/login", userController.login);

// Protected routes
router.get("/", authMiddleware, userController.getAllUsers);
router.get("/with-roles", authMiddleware, userController.getAllUsersWithRoles);
router.post("/create", authMiddleware, userController.createUser);
router.get("/:id", authMiddleware, userController.getUserById);
router.get("/:id/with-roles", authMiddleware, userController.getUserWithRoles);
router.put("/:id", authMiddleware, userController.updateUser);
router.delete("/:id", authMiddleware, userController.deleteUser);

module.exports = router;
