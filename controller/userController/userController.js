// controllers/userController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../../model/userModel/userModel");
const EmailService = require("../../services/EmailService");
const crypto = require("crypto");
const authAuditLogger = require("../../utils/authAuditLogger");
require("dotenv").config();

// Register a new user
exports.register = async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      first_name,
      last_name,
      phone_number,
      role_id,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists with this email." });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Validate required fields
    if (!username || !email || !password || !first_name || !last_name) {
      return res.status(400).json({
        message: "Missing required fields: username, email, password, first_name, last_name"
      });
    }

    // Create user (initially unverified, self-registered)
    const userId = await User.createUser({
      username: username || null,
      email: email || null,
      password_hash: password_hash || null,
      first_name: first_name || null,
      last_name: last_name || null,
      phone_number: phone_number || null,
      role_id: role_id || 4,
    });

    // Store user in user_roles table
    const UserRoleModel = require("../../model/rbacModel/userRoleModel");
    await UserRoleModel.assignRoleToUser(userId, role_id || 4, userId);

    // Generate and send OTP
    const OTPModel = require("../../model/otpModel/otpModel");

    // Check rate limiting (max 3 OTPs per hour)
    const otpCount = await OTPModel.getOTPAttemptsCount(email);
    if (otpCount >= 3) {
      return res.status(429).json({
        message: "Too many OTP requests. Please try again after an hour."
      });
    }

    // Generate 6-digit OTP
    const otp_code = crypto.randomInt(100000, 999999).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store OTP in database
    await OTPModel.createOTP({
      email,
      otp_code,
      expires_at,
    });

    // Send OTP email
    let emailResult;
    try {
      emailResult = await EmailService.sendOTPEmail(email, otp_code, first_name);
    } catch (emailError) {
      console.error("Email service error:", emailError);
      emailResult = { success: false, error: emailError.message };
    }

    if (!emailResult.success) {
      console.error("Failed to send OTP email:", emailResult.error);

      // Log the OTP to console for development/testing
      console.log("📧 OTP EMAIL FAILED - LOGGING OTP FOR TESTING:");
      console.log("=".repeat(50));
      console.log(`Email: ${email}`);
      console.log(`OTP Code: ${otp_code}`);
      console.log(`Error: ${emailResult.error}`);
      console.log("=".repeat(50));

      // Return success but indicate email issue
      return res.status(201).json({
        message: "User registered successfully. Email service temporarily unavailable - please contact support for OTP.",
        userId,
        email_sent: false,
        otp_logged: true,
        support_message: "OTP has been logged to server console for testing purposes."
      });
    }

    // Log successful registration
    await authAuditLogger.logRegister(req, { id: userId, email, first_name, last_name }, true);

    res.status(201).json({
      message: "User registered successfully. Please check your email for OTP verification.",
      userId,
      email_sent: true
    });
  } catch (error) {
    console.error("Error registering user:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });

    // Log failed registration
    await authAuditLogger.logRegister(req, null, false, error.message);

    res.status(500).json({
      message: "Server error.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp_code } = req.body;

    if (!email || !otp_code) {
      return res.status(400).json({
        message: "Email and OTP code are required."
      });
    }

    const OTPModel = require("../../model/otpModel/otpModel");

    // Find valid OTP
    const validOTP = await OTPModel.findValidOTP(email, otp_code);

    if (!validOTP) {
      // Log failed OTP verification
      await authAuditLogger.logOTPVerification(req, { email }, false, "Invalid or expired OTP code");

      return res.status(400).json({
        message: "Invalid or expired OTP code."
      });
    }

    // Mark OTP as used
    await OTPModel.markOTPAsUsed(validOTP.id);

    // Update user email verification status
    await User.updateEmailVerification(email);

    // Clean up all OTPs for this email
    await OTPModel.deleteOTPsByEmail(email);

    // Log successful OTP verification
    await authAuditLogger.logOTPVerification(req, { email }, true);

    res.status(200).json({
      message: "Email verified successfully. You can now login."
    });
  } catch (error) {
    console.error("OTP verification error:", error);

    // Log failed OTP verification
    await authAuditLogger.logOTPVerification(req, { email: req.body?.email }, false, error.message);

    res.status(500).json({ message: "Server error during OTP verification." });
  }
};

// Resend OTP
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required."
      });
    }

    // Check if user exists
    const user = await User.findUserByEmail(email);
    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    // Check if already verified
    const isVerified = await User.isEmailVerified(email);
    if (isVerified) {
      return res.status(400).json({
        message: "Email is already verified."
      });
    }

    const OTPModel = require("../../model/otpModel/otpModel");

    // Check rate limiting (max 5 OTPs per hour)
    const otpCount = await OTPModel.getOTPAttemptsCount(email);
    if (otpCount >= 5) {
      return res.status(429).json({
        message: "Too many OTP requests. Please try again after an hour."
      });
    }

    // Generate new OTP
    const otp_code = crypto.randomInt(100000, 999999).toString();
    const expires_at = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Store OTP in database
    await OTPModel.createOTP({
      email,
      otp_code,
      expires_at,
    });

    // Send OTP email
    let emailResult;
    try {
      emailResult = await EmailService.sendOTPEmail(email, otp_code, user.first_name);
    } catch (emailError) {
      console.error("Email service error:", emailError);
      emailResult = { success: false, error: emailError.message };
    }

    if (!emailResult.success) {
      console.error("Failed to send OTP email:", emailResult.error);

      // Log the OTP to console for development/testing
      console.log("📧 RESEND OTP EMAIL FAILED - LOGGING OTP FOR TESTING:");
      console.log("=".repeat(50));
      console.log(`Email: ${email}`);
      console.log(`OTP Code: ${otp_code}`);
      console.log(`Error: ${emailResult.error}`);
      console.log("=".repeat(50));

      return res.status(200).json({
        message: "OTP generated successfully. Email service temporarily unavailable - check server console for OTP.",
        email_sent: false,
        otp_logged: true,
        support_message: "OTP has been logged to server console for testing purposes."
      });
    }

    // Log successful OTP resend
    await authAuditLogger.logOTPResend(req, { email }, true);

    res.status(200).json({
      message: "OTP sent successfully. Please check your email.",
      email_sent: true
    });
  } catch (error) {
    console.error("Resend OTP error:", error);

    // Log failed OTP resend
    await authAuditLogger.logOTPResend(req, { email: req.body?.email }, false, error.message);

    res.status(500).json({ message: "Server error during OTP resend." });
  }
};

// Login a user
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findUserByEmail(email);
    if (!user) {
      // Log failed login - user not found
      await authAuditLogger.logLogin(req, { email }, false, "User not found");
      return res.status(400).json({ message: "User Not Found!" });
    }

    // Check if user is active
    if (!user.is_active) {
      // Log failed login - account inactive
      await authAuditLogger.logLogin(req, user, false, "Account is inactive");
      return res.status(403).json({
        message: "Account is inactive. Please contact administrator."
      });
    }

    // Check if email is verified
    // Note: Admin-created users are automatically marked as email_verified=true
    // Self-registered users need to verify their email via OTP
    if (!user.email_verified) {
      // Log failed login - email not verified
      await authAuditLogger.logLogin(req, user, false, "Email not verified");
      return res.status(403).json({
        message: "Please verify your email before logging in. Check your email for OTP.",
        email_verified: false
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      // Log failed login - invalid credentials
      await authAuditLogger.logLogin(req, user, false, "Invalid credentials");
      return res.status(400).json({ message: "Invalid credentials." });
    }

    // Update last login
    await User.updateLastLogin(user.id);
    const { username, first_name, last_name } = user;
    // Create JWT
    const payload = {
      user: {
        id: user.id,
        username: username,
        email: email,
        first_name: first_name,
        last_name: last_name,
        role_id: user.role_id,
      },
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1y",
    });

    // Log successful login
    await authAuditLogger.logLogin(req, user, true);

    res.status(200).json({ message: "Login Success", data: token });
  } catch (error) {
    console.error(error);

    // Log failed login - server error
    await authAuditLogger.logLogin(req, { email: req.body?.email }, false, error.message);

    res.status(500).json({ message: "Server error." });
  }
};

// Get all users - with user isolation
exports.getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Super admin can see all users, regular users can only see themselves
    if (isSuperAdmin) {
      const users = await User.getAllUsers();
      res.json(users);
    } else {
      // Regular users can only see their own information
      const user = await User.findUserById(currentUserId);
      if (!user) {
        return res.status(404).json({ message: "User not found." });
      }
      res.json([user]); // Return as array for consistency
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get all users with roles - with user isolation
exports.getAllUsersWithRoles = async (req, res) => {
  try {
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Super admin can see all users, regular users can only see themselves
    if (isSuperAdmin) {
      const users = await User.getAllUsersWithRoles();
      res.status(200).json({
        success: true,
        message: "Users with roles retrieved successfully",
        data: users
      });
    } else {
      // Regular users can only see their own information
      const user = await User.getUserWithRoles(currentUserId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      res.status(200).json({
        success: true,
        message: "User with roles retrieved successfully",
        data: [user] // Return as array for consistency
      });
    }
  } catch (error) {
    console.error("Error fetching users with roles:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching users"
    });
  }
};

// Get user by ID - with user isolation
exports.getUserById = async (req, res) => {
  try {
    const requestedUserId = req.params.id;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Super admin can access any user, regular users can only access their own data
    if (!isSuperAdmin && parseInt(requestedUserId) !== parseInt(currentUserId)) {
      return res.status(403).json({
        message: "Access denied. You can only view your own information."
      });
    }

    const user = await User.findUserById(requestedUserId);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error." });
  }
};

// Get user with roles by ID - with user isolation
exports.getUserWithRoles = async (req, res) => {
  try {
    const requestedUserId = req.params.id;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Super admin can access any user, regular users can only access their own data
    if (!isSuperAdmin && parseInt(requestedUserId) !== parseInt(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only view your own information."
      });
    }

    const user = await User.getUserWithRoles(requestedUserId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    res.status(200).json({
      success: true,
      message: "User with roles retrieved successfully",
      data: user
    });
  } catch (error) {
    console.error("Error fetching user with roles:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user"
    });
  }
};

// Update user - with user isolation
exports.updateUser = async (req, res) => {
  try {
    const {
      username,
      email,
      first_name,
      last_name,
      phone_number,
      role_id,
      is_active,
    } = req.body;
    const userId = req.params.id;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Super admin can update any user, regular users can only update themselves
    if (!isSuperAdmin && parseInt(userId) !== parseInt(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only update your own information."
      });
    }

    // Regular users cannot change their role or active status
    if (!isSuperAdmin) {
      if (role_id !== undefined || is_active !== undefined) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You cannot modify role or active status."
        });
      }
    }

    // Optionally, add checks to prevent duplicate emails/usernames
    const existingUser = await User.findUserByEmail(email);
    if (existingUser && existingUser.id !== parseInt(userId)) {
      return res
        .status(400)
        .json({ message: "Email is already in use by another user." });
    }

    const updateData = {
      username,
      email,
      first_name,
      last_name,
      phone_number,
    };

    // Only super admin can update role and active status
    if (isSuperAdmin) {
      if (role_id !== undefined) updateData.role_id = role_id;
      if (is_active !== undefined) updateData.is_active = is_active;
    }

    const affectedRows = await User.updateUser(userId, updateData);

    if (affectedRows === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: "User not found or no changes made."
        });
    }

    res.json({
      success: true,
      message: "User updated successfully."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};

// Create user (Super Admin only)
exports.createUser = async (req, res) => {
  try {
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Only super admin can create users
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super admin can create users."
      });
    }

    const {
      username,
      email,
      password,
      first_name,
      last_name,
      phone_number,
      role_id,
    } = req.body;

    // Check if user already exists
    const existingUser = await User.findUserByEmail(email);
    if (existingUser) {
      return res
        .status(400)
        .json({
          success: false,
          message: "User already exists with this email."
        });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    // Create user (admin-created users are automatically verified)
    const userId = await User.createUser({
      username,
      email,
      password_hash,
      first_name,
      last_name,
      phone_number,
      role_id,
    });

    // Mark admin-created user as email verified (no OTP required)
    await User.updateEmailVerificationById(userId, true);

    res.status(201).json({
      success: true,
      message: "User created successfully (email automatically verified)",
      data: {
        id: userId,
        email_verified: true
      }
    });
  } catch (error) {
    console.error("Error creating user:", error);
    console.error("Error stack:", error.stack);
    console.error("Error details:", {
      message: error.message,
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });

    res.status(500).json({
      success: false,
      message: "Server error while creating user",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Delete user - with user isolation (Super Admin only)
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Only super admin can delete users
    if (!isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only super admin can delete users."
      });
    }

    // Prevent super admin from deleting themselves
    if (parseInt(userId) === parseInt(currentUserId)) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own account."
      });
    }

    const affectedRows = await User.deleteUser(userId);

    if (affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found."
      });
    }

    res.json({
      success: true,
      message: "User deleted successfully."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Server error."
    });
  }
};
