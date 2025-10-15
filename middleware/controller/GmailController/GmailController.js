const GmailService = require('../../services/GmailService');
const gmailService = new GmailService();
const pool = require('../../config/DBConnection');
const systemAuditLogger = require('../../utils/systemAuditLogger');
require('dotenv').config();

// Gmail OAuth - Generate authorization URL
const generateGmailAuthUrl = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { redirectPath } = req.query; // Get redirect path from query params

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const authUrl = gmailService.generateAuthUrl(userId, redirectPath || '/webhooks');

    console.log('🔗 Generated Gmail OAuth URL:', authUrl);
    console.log('🔧 OAuth parameters:', {
      userId,
      redirectPath: redirectPath || '/webhooks',
      clientId: process.env.GMAIL_CLIENT_ID?.substring(0, 20) + '...',
      redirectUri: process.env.GMAIL_REDIRECT_URI
    });

    res.status(200).json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    console.error("Error generating Gmail auth URL:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate Gmail authorization URL",
      error: error.message
    });
  }
};

// Gmail OAuth Proxy - Serve OAuth page that opens popup
const serveGmailOAuthProxy = async (req, res) => {
  try {
    const { userId, redirectPath } = req.query;

    if (!userId) {
      return res.status(400).send('User ID is required');
    }

    const authUrl = gmailService.generateAuthUrl(userId, redirectPath || '/webhooks');

    // Create an HTML page that opens Gmail OAuth in a popup and communicates back
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Gmail Authentication</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                margin: 0;
                padding: 20px;
                background: #f8f9fa;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
            }
            .container {
                text-align: center;
                background: white;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                max-width: 400px;
            }
            .gmail-icon {
                width: 48px;
                height: 48px;
                margin: 0 auto 20px;
                background: #ea4335;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                font-size: 24px;
                font-weight: bold;
            }
            .btn {
                background: #4285f4;
                color: white;
                border: none;
                padding: 12px 24px;
                border-radius: 6px;
                font-size: 16px;
                cursor: pointer;
                margin-top: 20px;
            }
            .btn:hover {
                background: #3367d6;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="gmail-icon">📧</div>
            <h2>Connect Gmail Account</h2>
            <p>Click the button below to authenticate with Gmail</p>
            <button class="btn" onclick="openGmailAuth()">Authenticate with Gmail</button>
            <p style="font-size: 12px; color: #666; margin-top: 20px;">
                A popup window will open for authentication
            </p>
        </div>
        <script>
            function openGmailAuth() {
                // Open Gmail OAuth in a popup
                const popup = window.open(
                    '${authUrl}',
                    'gmail-oauth',
                    'width=500,height=600,scrollbars=yes,resizable=yes,left=' +
                    (window.screen.width / 2 - 250) + ',top=' + (window.screen.height / 2 - 300)
                );

                if (!popup) {
                    alert('Popup blocked. Please allow popups and try again.');
                    return;
                }

                // Update UI to show waiting state
                document.querySelector('.container').innerHTML = \`
                    <div class="gmail-icon">📧</div>
                    <h2>Authenticating...</h2>
                    <p>Please complete authentication in the popup window</p>
                    <div style="margin: 20px 0;">
                        <div style="border: 3px solid #f3f3f3; border-top: 3px solid #4285f4; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 0 auto;"></div>
                    </div>
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                \`;

                // Monitor popup for closure
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        // Notify parent window that popup was closed
                        if (window.parent && window.parent !== window) {
                            window.parent.postMessage({
                                type: 'GMAIL_POPUP_CLOSED'
                            }, '*');
                        }
                    }
                }, 1000);
            }

            // Listen for messages from the OAuth callback
            window.addEventListener('message', function(event) {
                if (event.data.type === 'GMAIL_AUTH_SUCCESS') {
                    // Forward the success message to the parent window (modal)
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage(event.data, '*');
                    }
                } else if (event.data.type === 'GMAIL_AUTH_ERROR') {
                    // Forward the error message to the parent window (modal)
                    if (window.parent && window.parent !== window) {
                        window.parent.postMessage(event.data, '*');
                    }
                }
            });

            // Auto-open Gmail auth when page loads
            setTimeout(() => {
                openGmailAuth();
            }, 500);
        </script>
    </body>
    </html>
    `;

    // Set headers to allow iframe embedding
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', 'frame-ancestors *');
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error("Error serving Gmail OAuth proxy:", error);
    res.status(500).send('Internal server error');
  }
};

// Gmail OAuth callback - Handle GET redirect from Google OAuth
const handleGmailOAuthCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;

    // Parse state to determine if this is a popup flow
    let stateData = {};
    let isPopupFlow = false;

    if (state) {
      try {
        stateData = JSON.parse(state);
        isPopupFlow = stateData.redirectPath === 'popup';
      } catch (e) {
        console.error('Error parsing state:', e);
      }
    }

    // Handle OAuth error
    if (error) {
      console.error("Gmail OAuth error:", error);
      if (isPopupFlow) {
        // For popup flow, redirect to a popup callback page that will close the popup
        return res.redirect(`${process.env.FRONTEND_URL}/#/gmail/popup-callback?error=${encodeURIComponent(error)}`);
      } else {
        return res.redirect(`${process.env.FRONTEND_URL}/#/webhooks?gmail_error=${encodeURIComponent(error)}`);
      }
    }

    if (!code) {
      if (isPopupFlow) {
        return res.redirect(`${process.env.FRONTEND_URL}/#/gmail/popup-callback?error=no_code`);
      } else {
        return res.redirect(`${process.env.FRONTEND_URL}/#/webhooks?gmail_error=no_code`);
      }
    }

    if (!state) {
      if (isPopupFlow) {
        return res.redirect(`${process.env.FRONTEND_URL}/#/gmail/popup-callback?error=no_state`);
      } else {
        return res.redirect(`${process.env.FRONTEND_URL}/#/webhooks?gmail_error=no_state`);
      }
    }

    // Parse state parameter (should be JSON object with userId and workflow state)
    let userId;
    let redirectPath = '/webhooks'; // Default redirect path
    let isModal = false;
    let returnToWorkflow = false;
    let workflowState = null;

    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      userId = parseInt(stateData.userId);
      redirectPath = stateData.redirectPath || '/webhooks';
      isModal = stateData.modal === true;
      returnToWorkflow = stateData.returnToWorkflow === true;
      workflowState = stateData.workflowState;

      console.log('🔍 Parsed OAuth state:', {
        userId,
        returnToWorkflow,
        workflowState: workflowState ? {
          fullUrl: workflowState.fullUrl,
          pathname: workflowState.pathname,
          search: workflowState.search,
          hash: workflowState.hash
        } : null
      });
    } catch (e) {
      // Fallback: treat state as simple user ID
      userId = parseInt(state);
      console.warn('State parameter is not JSON, treating as simple user ID:', state);
    }

    if (!userId) {
      return res.redirect(`${process.env.FRONTEND_URL}/#/webhooks?gmail_error=invalid_state`);
    }

    // Exchange code for tokens
    const tokens = await gmailService.exchangeCodeForTokens(code, userId);

    // Get user profile to verify connection
    const profile = await gmailService.getUserProfile(userId);

    // Log successful Gmail connection
    await systemAuditLogger.logGmailOperation(req, 'CONNECT_GMAIL',
      { userId, email: profile.emailAddress }, true);

    // Redirect back to frontend with success
    if (isPopupFlow) {
      // For popup flow, redirect to popup callback page that will close popup and notify parent
      const callbackUrl = `${process.env.FRONTEND_URL}/#/gmail/popup-callback?success=true&email=${encodeURIComponent(profile.emailAddress)}`;
      res.redirect(callbackUrl);
    } else {
      // For all other flows, redirect to webhooks page (backward compatibility)
      const finalRedirectUrl = `${process.env.FRONTEND_URL}/#/webhooks?gmail_success=true&email=${encodeURIComponent(profile.emailAddress)}`;
      res.redirect(finalRedirectUrl);
    }
  } catch (error) {
    console.error("Error handling Gmail OAuth callback:", error);

    // Log failed Gmail connection
    await systemAuditLogger.logGmailOperation(req, 'CONNECT_GMAIL',
      { error: error.message }, false);

    // Redirect back to frontend with error
    // For errors, we don't know if it was from modal, so redirect to callback page which can handle both
    res.redirect(`${process.env.FRONTEND_URL}/#/webhooks/gmail/callback?error=${encodeURIComponent(error.message)}`);
  }
};

// Gmail OAuth callback - Exchange code for tokens (POST version for API calls)
const handleGmailCallback = async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Authorization code is required"
      });
    }

    if (!state) {
      return res.status(400).json({
        success: false,
        message: "State parameter is required"
      });
    }

    // Parse state parameter (could be JSON object or simple user ID)
    let userId;
    try {
      const stateData = JSON.parse(decodeURIComponent(state));
      userId = parseInt(stateData.userId);
    } catch (e) {
      // Fallback: treat state as simple user ID
      userId = parseInt(state);
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in state parameter"
      });
    }

    // Exchange code for tokens
    const tokens = await gmailService.exchangeCodeForTokens(code, userId);
    
    // Get user profile to verify connection
    const profile = await gmailService.getUserProfile(userId);
    
    // Log successful Gmail connection
    await systemAuditLogger.logGmailOperation(req, 'CONNECT_GMAIL', 
      { userId, email: profile.emailAddress }, true);

    res.status(200).json({
      success: true,
      message: "Gmail connected successfully",
      data: {
        email: profile.emailAddress,
        messagesTotal: profile.messagesTotal,
        threadsTotal: profile.threadsTotal
      }
    });
  } catch (error) {
    console.error("Error handling Gmail callback:", error);
    
    // Log failed Gmail connection
    await systemAuditLogger.logGmailOperation(req, 'CONNECT_GMAIL', 
      { error: error.message }, false);
    
    res.status(500).json({
      success: false,
      message: "Failed to connect Gmail",
      error: error.message
    });
  }
};

// Get Gmail connection status
const getGmailStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const isConnected = await gmailService.isGmailConnected(userId);
    
    let profile = null;
    if (isConnected) {
      try {
        profile = await gmailService.getUserProfile(userId);
      } catch (error) {
        console.error("Error getting Gmail profile:", error);
        // If we can't get profile, tokens might be expired
        return res.status(200).json({
          success: true,
          data: {
            isConnected: false,
            needsReauth: true,
            profile: null
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        isConnected,
        profile: profile ? {
          email: profile.emailAddress,
          messagesTotal: profile.messagesTotal,
          threadsTotal: profile.threadsTotal
        } : null
      }
    });
  } catch (error) {
    console.error("Error getting Gmail status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get Gmail status",
      error: error.message
    });
  }
};

// Disconnect Gmail
const disconnectGmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    await gmailService.disconnectGmail(userId);
    
    // Log Gmail disconnection
    await systemAuditLogger.logGmailOperation(req, 'DISCONNECT_GMAIL', 
      { userId }, true);

    res.status(200).json({
      success: true,
      message: "Gmail disconnected successfully"
    });
  } catch (error) {
    console.error("Error disconnecting Gmail:", error);
    
    // Log failed Gmail disconnection
    await systemAuditLogger.logGmailOperation(req, 'DISCONNECT_GMAIL', 
      { userId: req.user?.id, error: error.message }, false);
    
    res.status(500).json({
      success: false,
      message: "Failed to disconnect Gmail",
      error: error.message
    });
  }
};

// List user's emails
const listEmails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { query = '', maxResults = 10 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const messages = await gmailService.listEmails(userId, query, parseInt(maxResults));
    
    res.status(200).json({
      success: true,
      data: { messages }
    });
  } catch (error) {
    console.error("Error listing emails:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list emails",
      error: error.message
    });
  }
};

// Get specific email details
const getEmailDetails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { messageId } = req.params;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!messageId) {
      return res.status(400).json({
        success: false,
        message: "Message ID is required"
      });
    }

    const email = await gmailService.getEmail(userId, messageId);
    
    res.status(200).json({
      success: true,
      data: { email }
    });
  } catch (error) {
    console.error("Error getting email details:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get email details",
      error: error.message
    });
  }
};

// Get Gmail emails stored in database
const getStoredEmails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { limit = 50, offset = 0 } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const connection = await pool.getConnection();
    try {
      const [emails] = await connection.execute(
        `SELECT message_id, from_address, email, name, subject, date, snippet, created_at
         FROM gmail_emails 
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [userId, parseInt(limit), parseInt(offset)]
      );
      
      // Get total count
      const [countResult] = await connection.execute(
        `SELECT COUNT(*) as total FROM gmail_emails WHERE user_id = ?`,
        [userId]
      );
      
      res.status(200).json({
        success: true,
        data: {
          emails,
          total: countResult[0].total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error getting stored emails:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get stored emails",
      error: error.message
    });
  }
};

// Send email via Gmail
const sendEmail = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { to, subject, body, isHtml = false } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!to || !subject || !body) {
      return res.status(400).json({
        success: false,
        message: "To, subject, and body are required"
      });
    }

    const result = await gmailService.sendEmail(userId, { to, subject, body, isHtml });

    // Log successful email send
    await systemAuditLogger.logGmailOperation(req, 'SEND_EMAIL',
      { userId, to, subject, messageId: result.id }, true);

    res.status(200).json({
      success: true,
      message: "Email sent successfully",
      data: result
    });
  } catch (error) {
    console.error("Error sending email:", error);

    // Log failed email send
    await systemAuditLogger.logGmailOperation(req, 'SEND_EMAIL',
      { userId: req.user?.id, error: error.message }, false);

    res.status(500).json({
      success: false,
      message: "Failed to send email",
      error: error.message
    });
  }
};

// Send bulk emails via Gmail
const sendBulkEmails = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { emails } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Emails array is required and must not be empty"
      });
    }

    const results = await gmailService.sendBulkEmails(userId, emails);

    // Log bulk email send
    await systemAuditLogger.logGmailOperation(req, 'SEND_BULK_EMAILS',
      { userId, emailCount: emails.length, results }, true);

    res.status(200).json({
      success: true,
      message: "Bulk emails processed",
      data: results
    });
  } catch (error) {
    console.error("Error sending bulk emails:", error);

    // Log failed bulk email send
    await systemAuditLogger.logGmailOperation(req, 'SEND_BULK_EMAILS',
      { userId: req.user?.id, error: error.message }, false);

    res.status(500).json({
      success: false,
      message: "Failed to send bulk emails",
      error: error.message
    });
  }
  
  // Set up Gmail watch for user
  const setupGmailWatch = async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID not found in token"
        });
      }
      
      const result = await gmailService.setupGmailWatch(userId);
      
      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error("Error setting up Gmail watch:", error);
      res.status(500).json({
        success: false,
        message: "Failed to set up Gmail watch",
        error: error.message
      });
    }
  };
  
  // Stop Gmail watch for user
  const stopGmailWatch = async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: "User ID not found in token"
        });
      }
      
      await gmailService.stopGmailWatch(userId);
      
      res.status(200).json({
        success: true,
        message: "Gmail watch stopped successfully"
      });
    } catch (error) {
      console.error("Error stopping Gmail watch:", error);
      res.status(500).json({
        success: false,
        message: "Failed to stop Gmail watch",
        error: error.message
      });
    }
  };
};

module.exports = {
  generateGmailAuthUrl,
  serveGmailOAuthProxy,
  handleGmailOAuthCallback,
  handleGmailCallback,
  getGmailStatus,
  disconnectGmail,
  listEmails,
  getEmailDetails,
  getStoredEmails,
  sendEmail,
  sendBulkEmails
};
