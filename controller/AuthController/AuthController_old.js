const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");
const pool = require("../../config/DBConnection");
const systemAuditLogger = require("../../utils/systemAuditLogger");
require("dotenv").config();

const secretKey = "ASAJKLDSLKDJLASJDLA";

// Helper: create signed state for OAuth (encodes userId and timestamp)
const createSignedState = (userId) => {
  const payload = JSON.stringify({ userId, ts: Date.now() });
  const signature = crypto
    .createHmac('sha256', process.env.JWT_SECRET || secretKey)
    .update(payload)
    .digest('hex');
  const state = Buffer.from(payload).toString('base64url') + "." + signature;
  return state;
};

// Helper: verify signed state
const verifySignedState = (state) => {
  try {
    if (!state || typeof state !== 'string' || !state.includes('.')) return null;
    const [b64, sig] = state.split('.');
    const payloadStr = Buffer.from(b64, 'base64url').toString('utf8');
    const expectedSig = crypto
      .createHmac('sha256', process.env.JWT_SECRET || secretKey)
      .update(payloadStr)
      .digest('hex');
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(payloadStr);
    if (!payload?.userId) return null;
    // Optional: 10-minute freshness window
    if (Date.now() - Number(payload.ts) > 10 * 60 * 1000) return null;
    return payload;
  } catch {
    return null;
  }
};

// Demo login for testing workflows
const demoLogin = async (req, res) => {
  try {
    const pool = require('../../config/DBConnection');
    const bcrypt = require('bcryptjs');

    const demoUserId = 999999;
    const demoEmail = 'demo@example.com';

    // Check if demo user exists in database
    const [existingUsers] = await pool.execute(
      'SELECT id, username, email, first_name, last_name, phone_number, role_id FROM users WHERE id = ? OR email = ?',
      [demoUserId, demoEmail]
    );

    let demoUser;

    if (existingUsers.length === 0) {
      // Create demo user in database if it doesn't exist
      console.log('Creating demo user in database...');

      const hashedPassword = await bcrypt.hash('demo123', 10);

      try {
        // First try to insert with specific ID
        await pool.execute(
          `INSERT INTO users (id, username, email, password_hash, first_name, last_name, phone_number, role_id, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          [demoUserId, 'demo_user', demoEmail, hashedPassword, 'Demo', 'User', '+1 (555) 123-4567', 1, 1]
        );
        console.log('Demo user created successfully with ID:', demoUserId);
      } catch (insertError) {
        console.log('Failed to create demo user with specific ID, trying without ID:', insertError.message);

        // If that fails, insert without specifying ID and get the auto-generated ID
        const [result] = await pool.execute(
          `INSERT INTO users (username, email, password_hash, first_name, last_name, phone_number, role_id, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
          ['demo_user', demoEmail, hashedPassword, 'Demo', 'User', '+1 (555) 123-4567', 1, 1]
        );

        // Update the demoUserId to the actual inserted ID
        demoUserId = result.insertId;
        console.log('Demo user created successfully with auto-generated ID:', demoUserId);
      }
    }

    // Get the actual user data from database if it exists, or use the created user ID
    const [userData] = await pool.execute(
      'SELECT id, username, email, first_name, last_name, phone_number, role_id FROM users WHERE id = ? OR email = ?',
      [demoUserId, demoEmail]
    );

    const actualUser = userData[0];

    // Create a demo user token
    demoUser = {
      id: actualUser ? actualUser.id : demoUserId,
      email: demoEmail,
      name: 'Demo User',
      first_name: 'Demo',
      last_name: 'User',
      username: 'demo_user',
      phone_number: '+1 (555) 123-4567',
      org_id: 'enterprise_demo',
      role: 'admin',
      created_at: '2024-01-01T00:00:00Z',
      last_login: new Date().toISOString()
    };

    // Generate JWT token
    const token = jwt.sign(demoUser, secretKey, { expiresIn: '24h' });

    res.status(200).json({
      success: true,
      message: "Demo login successful",
      data: {
        token,
        user: demoUser
      }
    });
  } catch (error) {
    console.error("Error in demo login:", error.message);
    res.status(500).json({
      success: false,
      message: "Demo login failed",
      error: error.message
    });
  }
};

// Get current user info
const getCurrentUser = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated"
      });
    }

    res.status(200).json({
      success: true,
      message: "User info retrieved successfully",
      data: user
    });
  } catch (error) {
    console.error("Error getting current user:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to get user info",
      error: error.message
    });
  }
};

// Facebook OAuth integration
const facebookAuth = async (req, res) => {
  try {
    const { code, state } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required"
      });
    }

    // Exchange code for access token
    const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        code: code
      }
    });

    const { access_token, expires_in } = tokenResponse.data;

    // Get user info from Facebook
    const userResponse = await axios.get('https://graph.facebook.com/v18.0/me', {
      params: {
        access_token: access_token,
        fields: 'id,name,email'
      }
    });

    const facebookUser = userResponse.data;

    // Store Facebook credentials in database
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO facebook_credentials (user_id, facebook_user_id, access_token, expires_at, facebook_name, facebook_email, created_at, updated_at)
         VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         expires_at = VALUES(expires_at),
         facebook_name = VALUES(facebook_name),
         facebook_email = VALUES(facebook_email),
         updated_at = NOW()`,
        [userId, facebookUser.id, access_token, expires_in, facebookUser.name, facebookUser.email]
      );
    } finally {
      connection.release();
    }

    // Log successful Facebook authentication
    await systemAuditLogger.logFacebookCall(req, 'CONNECT_ACCOUNT', '/oauth/access_token',
      { code, state }, { facebook_user: facebookUser }, true);

  // Redirect to frontend popup callback route with user info as query params
  const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=true&name=${encodeURIComponent(facebookUser.name || '')}&email=${encodeURIComponent(facebookUser.email || '')}&id=${encodeURIComponent(facebookUser.id || '')}`;
  return res.redirect(frontendCallbackUrl);
  } catch (error) {
    console.error("Error in Facebook OAuth:", error.response?.data || error.message);

    // Log failed Facebook authentication
    await systemAuditLogger.logFacebookCall(req, 'CONNECT_ACCOUNT', '/oauth/access_token',
      { code, state }, error.response?.data, false, error.message);

  // Redirect to frontend popup callback route with error message
  const errorMsg = encodeURIComponent(error.response?.data?.error_description || error.response?.data?.error || error.message || 'Unknown error');
  const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=${errorMsg}`;
  return res.redirect(frontendCallbackUrl);
  }
};

// Get Facebook connection status
const getFacebookStatus = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token",
        data: {
          isConnected: false
        }
      });
    }

    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT facebook_user_id, facebook_name, facebook_email, expires_at, created_at
         FROM facebook_credentials
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      );

      if (rows.length > 0) {
        const credential = rows[0];
        res.status(200).json({
          success: true,
          message: "Facebook account is connected",
          data: {
            isConnected: true,
            facebookUser: {
              id: credential.facebook_user_id,
              name: credential.facebook_name,
              email: credential.facebook_email
            },
            connectedAt: credential.created_at,
            expiresAt: credential.expires_at
          }
        });
      } else {
        res.status(200).json({
          success: true,
          message: "No Facebook account connected",
          data: {
            isConnected: false
          }
        });
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error checking Facebook status:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to check Facebook connection status",
      error: error.message
    });
  }
};

// Disconnect Facebook account
const disconnectFacebook = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `DELETE FROM facebook_credentials WHERE user_id = ?`,
        [userId]
      );
    } finally {
      connection.release();
    }

    res.status(200).json({
      success: true,
      message: "Facebook account disconnected successfully"
    });
  } catch (error) {
    console.error("Error disconnecting Facebook:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to disconnect Facebook account",
      error: error.message
    });
  }
};

module.exports = {
  demoLogin,
  getCurrentUser,
  facebookAuth,
  getFacebookStatus,
  disconnectFacebook,
  // Exported for routes we will add
  startFacebookOAuth: async (req, res) => {
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

      res.status(200).json({ success: true, url: oauthUrl });
    } catch (error) {
      console.error('Error starting Facebook OAuth:', error);
      res.status(500).json({ success: false, message: 'Failed to start Facebook OAuth' });
    }
  },
  facebookOAuthCallback: async (req, res) => {
    // Extract variables outside try block so they're accessible in catch block
    const { code, state, error } = req.query;

    try {
      console.log('🔍 Facebook OAuth callback received:', { code: !!code, state: !!state, error });

      // Handle OAuth error
      if (error) {
        console.error("Facebook OAuth error:", error);
        const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=${encodeURIComponent(error)}`;
        return res.redirect(frontendCallbackUrl);
      }

      if (!code || !state) {
        const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=missing_parameters`;
        return res.redirect(frontendCallbackUrl);
      }

      // Verify and parse state
      const userId = verifySignedState(state);
      if (!userId) {
        console.error('Invalid state parameter');
        const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=invalid_state`;
        return res.redirect(frontendCallbackUrl);
      }

      console.log('🔄 Processing Facebook OAuth for user:', userId);

      // Exchange code for access token
      const tokenResponse = await axios.post('https://graph.facebook.com/v18.0/oauth/access_token', {
        client_id: process.env.FACEBOOK_APP_ID,
        client_secret: process.env.FACEBOOK_APP_SECRET,
        redirect_uri: process.env.FACEBOOK_REDIRECT_URI,
        code: code
      });

      const { access_token: accessToken, expires_in: expiresIn } = tokenResponse.data;
      console.log('Facebook token response:', { access_token: 'present', expires_in: expiresIn });

      // Get user info from Facebook
      const userResponse = await axios.get(`https://graph.facebook.com/me?fields=id,name,email&access_token=${accessToken}`);
      const facebookUser = userResponse.data;
      console.log('Facebook user data:', { id: facebookUser.id, name: facebookUser.name });

      // Store Facebook connection in database
      const connection = await db.getConnection();
      try {
        const dbParams = [
          userId,
          facebookUser.id,
          accessToken,
          new Date(Date.now() + (expiresIn * 1000)),
          facebookUser.name || '',
          facebookUser.email || ''
        ];

        await connection.execute(
          `INSERT INTO facebook_connections (user_id, facebook_user_id, access_token, expires_at, facebook_name, facebook_email, created_at, updated_at)
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

      console.log('✅ Facebook connection stored successfully');

      // Log successful Facebook authentication
      await systemAuditLogger.logFacebookCall(req, 'CONNECT_ACCOUNT', '/oauth/access_token',
        { code, state }, { facebook_user: facebookUser }, true);

      // Use JavaScript redirect instead of server redirect for popup compatibility
      const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=true&name=${encodeURIComponent(facebookUser.name || '')}&email=${encodeURIComponent(facebookUser.email || '')}&id=${encodeURIComponent(facebookUser.id || '')}`;
      console.log('🔄 Redirecting to Facebook popup callback:', frontendCallbackUrl);
      return res.redirect(frontendCallbackUrl);
    } catch (error) {
      console.error('Facebook OAuth callback error:', error.response?.data || error.message);

      // Log failed Facebook authentication
      await systemAuditLogger.logFacebookCall(req, 'CONNECT_ACCOUNT', '/oauth/access_token',
        { code, state }, error.response?.data, false, error.message);

      // Use JavaScript redirect for error case too
      const errorMsg = encodeURIComponent(error.response?.data?.error_description || error.response?.data?.error || error.message || 'Unknown error');
      const frontendCallbackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/facebook/popup-callback?success=false&error=${errorMsg}`;

      return res.redirect(frontendCallbackUrl);
    }
  }
};
