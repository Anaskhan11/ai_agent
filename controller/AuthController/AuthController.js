const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../../config/DBConnection");
const systemAuditLogger = require("../../utils/systemAuditLogger");

// Helper functions for state management
const createSignedState = (userId) => {
  const payload = { userId, ts: Date.now() };
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  return jwt.sign(payload, secret, { expiresIn: '1h' });
};

const verifySignedState = (state) => {
  try {
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    return jwt.verify(state, secret);
  } catch (error) {
    console.error('State verification failed:', error);
    return null;
  }
};

// Demo login function
const demoLogin = async (req, res) => {
  try {
    const User = require('../../model/userModel/userModel');

    // Try to find the actual demo user in the database
    let demoUser = await User.findUserByEmail('demo@example.com');

    if (!demoUser) {
      // If demo user doesn't exist, create it
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('demo123', 10);

      const pool = require('../../config/DBConnection');
      const [result] = await pool.execute(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, role_id, is_active, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        ['demo_user', 'demo@example.com', hashedPassword, 'Demo', 'User', '+1 (555) 123-4567', 1, 1, 1]
      );

      // Get the created user
      demoUser = await User.findUserById(result.insertId);
    }

    const token = jwt.sign(
      { userId: demoUser.id, email: demoUser.email },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      data: {
        user: {
          id: demoUser.id,
          email: demoUser.email,
          name: `${demoUser.first_name} ${demoUser.last_name}`
        },
        token: token
      }
    });
  } catch (error) {
    console.error("Demo login error:", error);
    res.status(500).json({
      success: false,
      message: "Demo login failed"
    });
  }
};

// Get current user function
const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user data"
    });
  }
};

// Facebook OAuth start function
const startFacebookOAuth = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const clientId = process.env.FACEBOOK_APP_ID;
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return res.status(500).json({ success: false, message: 'Facebook app not configured' });
    }

    const scope = encodeURIComponent('pages_manage_metadata,leads_retrieval,pages_read_engagement,pages_manage_ads');
    const state = createSignedState(userId);
    const oauthUrl = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${state}`;

    res.status(200).json({ success: true, data: { authUrl: oauthUrl } });
  } catch (error) {
    console.error('Error starting Facebook OAuth:', error);
    res.status(500).json({ success: false, message: 'Failed to start Facebook OAuth' });
  }
};

// Facebook OAuth callback function
const facebookOAuthCallback = async (req, res) => {
  const { code, state, error } = req.query;
  
  try {
    console.log('Facebook OAuth callback received:', { code: !!code, state: !!state, error });

    if (error) {
      console.error("Facebook OAuth error:", error);
      const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=${encodeURIComponent(error)}`;
      return res.redirect(frontendCallbackUrl);
    }

    if (!code || !state) {
      const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=missing_parameters`;
      return res.redirect(frontendCallbackUrl);
    }

    const decoded = verifySignedState(state);
    if (!decoded?.userId) {
      console.error('Invalid state parameter');
      const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=invalid_state`;
      return res.redirect(frontendCallbackUrl);
    }

    const userId = decoded.userId;
    console.log('Processing Facebook OAuth for user:', userId);

    // Exchange code for access token
    const tokenResponse = await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', {
      client_id: process.env.FACEBOOK_APP_ID,
      client_secret: process.env.FACEBOOK_APP_SECRET,
      redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
      code: code
    });

    const { access_token: accessToken, expires_in: expiresIn } = tokenResponse.data;
    console.log('Facebook token response:', { access_token: 'present', expires_in: expiresIn });

    // Calculate expiration date (default to 60 days if not provided)
    const expirationSeconds = expiresIn || (60 * 24 * 60 * 60); // 60 days default
    const expiresAt = new Date(Date.now() + (expirationSeconds * 1000));
    console.log('Token expires at:', expiresAt.toISOString());

    // Get user info from Facebook
    const userResponse = await axios.get(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
    const facebookUser = userResponse.data;
    console.log('Facebook user data:', { id: facebookUser.id, name: facebookUser.name });

    // Store Facebook connection in database
    const connection = await pool.getConnection();
    try {
      const dbParams = [
        userId,
        facebookUser.id,
        accessToken,
        expiresAt,
        facebookUser.name || '',
        facebookUser.email || ''
      ];

      await connection.execute(
        `INSERT INTO facebook_credentials (user_id, facebook_user_id, access_token, expires_at, facebook_name, facebook_email, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         expires_at = VALUES(expires_at),
         facebook_name = VALUES(facebook_name),
         facebook_email = VALUES(facebook_email),
         updated_at = NOW()`,
        dbParams
      );
    } finally {
      connection.release();
    }

    console.log('Facebook connection stored successfully');

    // Log successful Facebook authentication
    await systemAuditLogger.logFacebookCall(req, 'CONNECT_ACCOUNT', '/oauth/access_token',
      { code, state }, { facebook_user: facebookUser }, true);

    // Redirect to frontend popup callback
    const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=true&name=${encodeURIComponent(facebookUser.name || '')}&email=${encodeURIComponent(facebookUser.email || '')}&id=${encodeURIComponent(facebookUser.id || '')}`;
    console.log('Redirecting to Facebook popup callback:', frontendCallbackUrl);
    return res.redirect(frontendCallbackUrl);
  } catch (error) {
    console.error('Facebook OAuth callback error:', error.response?.data || error.message);

    // Log failed Facebook authentication
    await systemAuditLogger.logFacebookCall(req, 'CONNECT_ACCOUNT', '/oauth/access_token',
      { code, state }, error.response?.data, false, error.message);

    // Redirect to frontend with error
    const errorMsg = encodeURIComponent(error.response?.data?.error_description || error.response?.data?.error || error.message || 'Unknown error');
    const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=${errorMsg}`;
    return res.redirect(frontendCallbackUrl);
  }
};

// Legacy Facebook auth function (for backward compatibility)
const facebookAuth = async (req, res) => {
  try {
    res.status(200).json({
      success: true,
      message: 'Use /facebook/oauth-url endpoint instead'
    });
  } catch (error) {
    console.error('Facebook auth error:', error);
    res.status(500).json({ success: false, message: 'Facebook auth failed' });
  }
};

// Get Facebook connection status
const getFacebookStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT facebook_user_id, facebook_name, facebook_email, created_at FROM facebook_credentials WHERE user_id = ? AND expires_at > NOW()',
        [userId]
      );

      const isConnected = rows.length > 0;
      const connectionData = isConnected ? rows[0] : null;

      res.status(200).json({
        success: true,
        data: {
          isConnected,
          connection: connectionData
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Get Facebook status error:', error);
    res.status(500).json({ success: false, message: 'Failed to get Facebook status' });
  }
};

// Disconnect Facebook account
const disconnectFacebook = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        'DELETE FROM facebook_credentials WHERE user_id = ?',
        [userId]
      );

      res.status(200).json({
        success: true,
        message: 'Facebook account disconnected successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Disconnect Facebook error:', error);
    res.status(500).json({ success: false, message: 'Failed to disconnect Facebook account' });
  }
};

// Change user password
const changePassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    const User = require('../../model/userModel/userModel');
    const bcrypt = require('bcryptjs');

    // Get current user
    const user = await User.findUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    // Update password in database
    const updateResult = await User.updateUserPassword(userId, hashedNewPassword);

    if (updateResult === 0) {
      return res.status(500).json({
        success: false,
        message: 'Failed to update password'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password'
    });
  }
};

module.exports = {
  demoLogin,
  getCurrentUser,
  facebookAuth,
  getFacebookStatus,
  disconnectFacebook,
  startFacebookOAuth,
  facebookOAuthCallback,
  changePassword
};
