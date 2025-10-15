const { google } = require('googleapis');
const pool = require('../config/DBConnection');
const axios = require('axios');
require('dotenv').config();

class GmailService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );
    
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    console.log('📧 Gmail service initialized');
  }

  // Generate OAuth URL for Gmail authorization
  generateAuthUrl(userId, redirectPath = '/webhooks') {
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://mail.google.com/'
    ];

    // Create state object with user ID and redirect path
    const stateData = {
      userId: userId,
      redirectPath: redirectPath
    };

    const authUrl = this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: JSON.stringify(stateData), // Pass structured state data
      prompt: 'consent' // Force consent screen to get refresh token
    });

    // Log the generated URL for debugging
    console.log('🔗 Generated OAuth URL:', authUrl);

    return authUrl;
  }

  // Exchange authorization code for tokens
  async exchangeCodeForTokens(code, userId) {
    try {
      // Use getToken instead of getAccessToken for OAuth code exchange
      const { tokens } = await this.oauth2Client.getToken(code);

      // Store tokens in database
      await this.storeUserTokens(userId, tokens);

      // Set credentials for this session
      this.oauth2Client.setCredentials(tokens);

      return tokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw error;
    }
  }

  // Store user tokens in database
  async storeUserTokens(userId, tokens) {
    const connection = await pool.getConnection();
    try {
      await connection.execute(
        `INSERT INTO gmail_tokens (user_id, access_token, refresh_token, token_type, expiry_date, scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
         access_token = VALUES(access_token),
         refresh_token = COALESCE(VALUES(refresh_token), refresh_token),
         token_type = VALUES(token_type),
         expiry_date = VALUES(expiry_date),
         scope = VALUES(scope),
         updated_at = NOW()`,
        [
          userId,
          tokens.access_token,
          tokens.refresh_token || null,
          tokens.token_type || 'Bearer',
          tokens.expiry_date ? new Date(tokens.expiry_date) : null,
          tokens.scope || null
        ]
      );
      console.log(`✅ Stored Gmail tokens for user ${userId}`);
    } finally {
      connection.release();
    }
  }

  // Get user tokens from database
  async getUserTokens(userId) {
    console.log(`🔍 Fetching Gmail tokens for user ID: ${userId}`);
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT access_token, refresh_token, token_type, expiry_date, scope
         FROM gmail_tokens WHERE user_id = ?`,
        [userId]
      );

      console.log(`📊 Gmail tokens query result for user ${userId}: found ${rows.length} records`);

      if (rows.length === 0) {
        console.log(`❌ No Gmail tokens found for user ${userId}`);
        return null;
      }

      const tokenData = rows[0];
      console.log(`✅ Gmail tokens found for user ${userId}: type=${tokenData.token_type}, expires=${tokenData.expiry_date ? tokenData.expiry_date.toISOString() : 'never'}`);

      return {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_type: tokenData.token_type,
        expiry_date: tokenData.expiry_date ? tokenData.expiry_date.getTime() : null,
        scope: tokenData.scope
      };
    } finally {
      connection.release();
    }
  }

  // Create a user-specific OAuth client to prevent credential sharing
  createUserOAuthClient(userId) {
    const userOAuthClient = new google.auth.OAuth2(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      process.env.GMAIL_REDIRECT_URI
    );

    console.log(`🔐 Created isolated OAuth client for user ${userId}`);
    return userOAuthClient;
  }

  // Set up OAuth client with user tokens (now user-specific)
  async setupUserAuth(userId) {
    const tokens = await this.getUserTokens(userId);
    if (!tokens) {
      throw new Error('No Gmail tokens found for user');
    }

    // Create a user-specific OAuth client instead of using shared instance
    const userOAuthClient = this.createUserOAuthClient(userId);
    userOAuthClient.setCredentials(tokens);

    // Set up automatic token refresh for this user's client
    userOAuthClient.on('tokens', async (newTokens) => {
      console.log(`🔄 Refreshing tokens for user ${userId}`);

      // Merge new tokens with existing ones
      const updatedTokens = { ...tokens, ...newTokens };

      // Store updated tokens
      await this.storeUserTokens(userId, updatedTokens);
      console.log(`✅ Tokens refreshed for user ${userId}`);
    });

    return { tokens, oauthClient: userOAuthClient };
  }

  // Get user's Gmail profile
  async getUserProfile(userId) {
    try {
      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });
      const response = await userGmail.users.getProfile({ userId: 'me' });
      return response.data;
    } catch (error) {
      console.error('Error getting Gmail profile:', error);
      throw error;
    }
  }

  // List user's emails with optional query
  async listEmails(userId, query = '', maxResults = 10) {
    try {
      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const response = await userGmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      return response.data.messages || [];
    } catch (error) {
      console.error('Error listing emails:', error);
      throw error;
    }
  }

  // Get specific email details
  async getEmail(userId, messageId) {
    try {
      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const response = await userGmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting email:', error);
      throw error;
    }
  }

  // Disconnect Gmail for user
  async disconnectGmail(userId) {
    const connection = await pool.getConnection();
    try {
      // Delete tokens
      await connection.execute(
        `DELETE FROM gmail_tokens WHERE user_id = ?`,
        [userId]
      );
      
      
      console.log(`✅ Disconnected Gmail for user ${userId}`);
    } finally {
      connection.release();
    }
  }

  // Check if user has Gmail connected
  async isGmailConnected(userId) {
    console.log(`🔍 Checking Gmail connection for user ID: ${userId}`);
    const tokens = await this.getUserTokens(userId);
    const isConnected = tokens !== null;

    if (isConnected && tokens) {
      console.log(`✅ Gmail connection check for user ${userId}: CONNECTED (has tokens)`);
      // Log some token info for debugging (without exposing sensitive data)
      console.log(`📊 Token info for user ${userId}: expires=${tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : 'never'}, type=${tokens.token_type}`);
    } else {
      console.log(`❌ Gmail connection check for user ${userId}: NOT CONNECTED (no tokens found)`);
    }

    return isConnected;
  }

  // Send email via Gmail API
  async sendEmail(userId, emailData) {
    try {
      console.log(`📧 Attempting to send email for user ${userId}:`, {
        to: emailData.to,
        cc: emailData.cc,
        bcc: emailData.bcc,
        subject: emailData.subject
      });
      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const { to, cc, bcc, subject, body, isHtml = false, attachments = [] } = emailData;

      // Create email headers
      const emailHeaders = [`To: ${to}`];

      if (cc && cc.trim()) {
        emailHeaders.push(`Cc: ${cc}`);
      }

      if (bcc && bcc.trim()) {
        emailHeaders.push(`Bcc: ${bcc}`);
      }

      emailHeaders.push(`Subject: ${subject}`);

      // Set content type based on isHtml flag
      const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
      emailHeaders.push(`Content-Type: ${contentType}`);

      // Create email message
      const email = [
        ...emailHeaders,
        '',
        body
      ].join('\n');

      // Encode email in base64
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      console.log(`📤 Sending email via Gmail API...`);
      const response = await userGmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail
        }
      });

      console.log(`✅ Email sent successfully via Gmail API: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error sending email via Gmail:', error);
      throw error;
    }
  }

  // Send bulk emails via Gmail API
  async sendBulkEmails(userId, emailsData) {
    try {
      const results = [];

      for (const emailData of emailsData) {
        try {
          const result = await this.sendEmail(userId, emailData);
          results.push({ success: true, messageId: result.id, to: emailData.to });
        } catch (error) {
          results.push({ success: false, error: error.message, to: emailData.to });
        }
      }

      return results;
    } catch (error) {
      console.error('Error sending bulk emails:', error);
      throw error;
    }
  }

  // Create draft email (new action from gmail-code)
  async createDraftEmail(userId, emailData) {
    try {
      console.log(`📝 Creating draft email for user ${userId}:`, {
        to: emailData.to,
        subject: emailData.subject
      });

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const { to, cc, bcc, subject, body, isHtml = false } = emailData;

      // Create email headers
      const emailHeaders = [`To: ${to}`];

      if (cc && cc.trim()) {
        emailHeaders.push(`Cc: ${cc}`);
      }

      if (bcc && bcc.trim()) {
        emailHeaders.push(`Bcc: ${bcc}`);
      }

      emailHeaders.push(`Subject: ${subject}`);

      // Set content type based on isHtml flag
      const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
      emailHeaders.push(`Content-Type: ${contentType}`);

      // Create email message
      const email = [
        ...emailHeaders,
        '',
        body
      ].join('\n');

      // Encode email in base64
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      console.log(`📝 Creating draft via Gmail API...`);
      const response = await userGmail.users.drafts.create({
        userId: 'me',
        requestBody: {
          message: {
            raw: encodedEmail
          }
        }
      });

      console.log(`✅ Draft created successfully: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error creating draft email:', error);
      throw error;
    }
  }

  // Reply to email (new action from gmail-code)
  async replyToEmail(userId, messageId, replyData) {
    try {
      console.log(`↩️ Replying to email ${messageId} for user ${userId}`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      // Get original message to extract thread ID and headers
      const originalMessage = await userGmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });

      const threadId = originalMessage.data.threadId;
      const originalHeaders = originalMessage.data.payload.headers;

      // Extract original subject and sender
      const originalSubject = originalHeaders.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      const originalFrom = originalHeaders.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const originalMessageId = originalHeaders.find(h => h.name.toLowerCase() === 'message-id')?.value || '';

      const { body, isHtml = false } = replyData;

      // Create reply headers
      const replySubject = originalSubject.startsWith('Re: ') ? originalSubject : `Re: ${originalSubject}`;
      const emailHeaders = [
        `To: ${originalFrom}`,
        `Subject: ${replySubject}`,
        `In-Reply-To: ${originalMessageId}`,
        `References: ${originalMessageId}`
      ];

      // Set content type
      const contentType = isHtml ? 'text/html; charset=utf-8' : 'text/plain; charset=utf-8';
      emailHeaders.push(`Content-Type: ${contentType}`);

      // Create reply message
      const email = [
        ...emailHeaders,
        '',
        body
      ].join('\n');

      // Encode email in base64
      const encodedEmail = Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

      console.log(`↩️ Sending reply via Gmail API...`);
      const response = await userGmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedEmail,
          threadId: threadId
        }
      });

      console.log(`✅ Reply sent successfully: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error('❌ Error replying to email:', error);
      throw error;
    }
  }

  // Star/unstar email (new action from gmail-code)
  async starEmail(userId, messageId, star = true) {
    try {
      console.log(`⭐ ${star ? 'Starring' : 'Unstarring'} email ${messageId} for user ${userId}`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const response = await userGmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          addLabelIds: star ? ['STARRED'] : [],
          removeLabelIds: star ? [] : ['STARRED']
        }
      });

      console.log(`✅ Email ${star ? 'starred' : 'unstarred'} successfully`);
      return response.data;
    } catch (error) {
      console.error(`❌ Error ${star ? 'starring' : 'unstarring'} email:`, error);
      throw error;
    }
  }

  // Move email to trash (new action from gmail-code)
  async moveEmailToTrash(userId, messageId) {
    try {
      console.log(`🗑️ Moving email ${messageId} to trash for user ${userId}`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const response = await userGmail.users.messages.trash({
        userId: 'me',
        id: messageId
      });

      console.log(`✅ Email moved to trash successfully`);
      return response.data;
    } catch (error) {
      console.error('❌ Error moving email to trash:', error);
      throw error;
    }
  }
  
  // Set up Gmail push notifications
  async setupGmailWatch(userId) {
    try {
      console.log(`🔧 Setting up Gmail watch for user ${userId}`);
      
      // Set up user authentication
      await this.setupUserAuth(userId);
      
      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      // Set up watch for new messages
      // Note: For this to work, you need to set up Google Cloud Pub/Sub
      // and configure the topic in your Google Cloud Console
      const watchResponse = await gmail.users.watch({
        userId: 'me',
        requestBody: {
          labelIds: ['INBOX'],
          topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`
        }
      });
      
      console.log(`✅ Gmail watch set up for user ${userId}:`, watchResponse.data);
      return watchResponse.data;
    } catch (error) {
      console.error(`Error setting up Gmail watch for user ${userId}:`, error);
      throw error;
    }
  }
  
  // Stop Gmail push notifications
  async stopGmailWatch(userId) {
    try {
      console.log(`🛑 Stopping Gmail watch for user ${userId}`);

      // Set up user authentication
      await this.setupUserAuth(userId);

      // Create Gmail API client
      const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      // Stop watching
      await gmail.users.stop({
        userId: 'me'
      });

      console.log(`✅ Gmail watch stopped for user ${userId}`);
    } catch (error) {
      console.error(`Error stopping Gmail watch for user ${userId}:`, error);
      throw error;
    }
  }

  // Dynamic data providers (from gmail-code reference)

  // List Gmail labels
  async listGmailLabels(userId) {
    try {
      console.log(`🏷️ Listing Gmail labels for user ${userId}`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const response = await userGmail.users.labels.list({
        userId: 'me'
      });

      const labels = response.data.labels.map(label => ({
        value: label.id,
        name: label.name,
        type: label.type
      }));

      console.log(`✅ Found ${labels.length} Gmail labels`);
      return labels;
    } catch (error) {
      console.error('❌ Error listing Gmail labels:', error);
      throw error;
    }
  }

  // List user email addresses/aliases
  async listUserEmails(userId) {
    try {
      console.log(`📧 Listing user emails for user ${userId}`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      // Get user profile to get primary email
      const profileResponse = await userGmail.users.getProfile({
        userId: 'me'
      });

      const emails = [{
        value: profileResponse.data.emailAddress,
        name: profileResponse.data.emailAddress,
        isPrimary: true
      }];

      // TODO: Add support for aliases if needed
      // This would require additional Gmail API calls to get send-as addresses

      console.log(`✅ Found ${emails.length} user emails`);
      return emails;
    } catch (error) {
      console.error('❌ Error listing user emails:', error);
      throw error;
    }
  }

  // List Gmail signatures
  async listGmailSignatures(userId) {
    try {
      console.log(`✍️ Listing Gmail signatures for user ${userId}`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      // Get send-as settings which include signatures
      const sendAsResponse = await userGmail.users.settings.sendAs.list({
        userId: 'me'
      });

      const signatures = [];

      for (const sendAs of sendAsResponse.data.sendAs) {
        if (sendAs.signature) {
          signatures.push({
            value: sendAs.signature,
            name: `${sendAs.displayName || sendAs.sendAsEmail} Signature`,
            email: sendAs.sendAsEmail
          });
        }
      }

      // Add default empty signature option
      signatures.unshift({
        value: '',
        name: 'No Signature',
        email: null
      });

      console.log(`✅ Found ${signatures.length} Gmail signatures`);
      return signatures;
    } catch (error) {
      console.error('❌ Error listing Gmail signatures:', error);
      throw error;
    }
  }

  // List Gmail messages with optional query
  async listGmailMessages(userId, query = '', maxResults = 10) {
    try {
      console.log(`📨 Listing Gmail messages for user ${userId} with query: "${query}"`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const response = await userGmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      if (!response.data.messages) {
        return [];
      }

      const messages = response.data.messages.map(message => ({
        value: message.id,
        name: `Message ${message.id}`,
        threadId: message.threadId
      }));

      console.log(`✅ Found ${messages.length} Gmail messages`);
      return messages;
    } catch (error) {
      console.error('❌ Error listing Gmail messages:', error);
      throw error;
    }
  }

  // List Gmail threads
  async listGmailThreads(userId, query = '', maxResults = 10) {
    try {
      console.log(`🧵 Listing Gmail threads for user ${userId} with query: "${query}"`);

      const { oauthClient } = await this.setupUserAuth(userId);
      const userGmail = google.gmail({ version: 'v1', auth: oauthClient });

      const response = await userGmail.users.threads.list({
        userId: 'me',
        q: query,
        maxResults: maxResults
      });

      if (!response.data.threads) {
        return [];
      }

      const threads = response.data.threads.map(thread => ({
        value: thread.id,
        name: `Thread ${thread.id}`,
        snippet: thread.snippet || ''
      }));

      console.log(`✅ Found ${threads.length} Gmail threads`);
      return threads;
    } catch (error) {
      console.error('❌ Error listing Gmail threads:', error);
      throw error;
    }
  }
}

module.exports = GmailService;
