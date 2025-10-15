const axios = require("axios");
const pool = require("../config/DBConnection");
require("dotenv").config();

class FacebookService {
  constructor() {
    this.baseUrl = "https://graph.facebook.com/v18.0";
  }

  // Get user's Facebook access token
  async getUserAccessToken(userId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT access_token FROM facebook_credentials 
         WHERE user_id = ? AND expires_at > NOW()`,
        [userId]
      );
      
      if (rows.length === 0) {
        throw new Error("No valid Facebook access token found");
      }
      
      return rows[0].access_token;
    } finally {
      connection.release();
    }
  }

  // Get user's Facebook pages
  async getUserPages(userId) {
    try {
      const accessToken = await this.getUserAccessToken(userId);
      console.log('🔍 Fetching Facebook pages for user:', userId);

      const response = await axios.get(`${this.baseUrl}/me/accounts`, {
        params: {
          access_token: accessToken,
          fields: 'id,name,category,access_token'
        }
      });

      const pages = response.data.data || [];
      console.log('📄 Facebook API returned pages:', pages.length, pages);
      
      // Store pages in database
      const connection = await pool.getConnection();
      try {
        // Get Facebook user ID
        const [credRows] = await connection.execute(
          `SELECT facebook_user_id FROM facebook_credentials WHERE user_id = ?`,
          [userId]
        );
        
        if (credRows.length === 0) {
          throw new Error("Facebook credentials not found");
        }
        
        const facebookUserId = credRows[0].facebook_user_id;

        // Clear existing pages and insert new ones
        await connection.execute(
          `DELETE FROM facebook_pages WHERE user_id = ?`,
          [userId]
        );

        for (const page of pages) {
          await connection.execute(
            `INSERT INTO facebook_pages (user_id, facebook_user_id, page_id, page_name, page_access_token, page_category)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, facebookUserId, page.id, page.name, page.access_token, page.category]
          );
        }
      } finally {
        connection.release();
      }

      return pages;
    } catch (error) {
      console.error("Error fetching Facebook pages:", error.response?.data || error.message);
      throw error;
    }
  }

  // Get lead forms for a specific page
  async getPageLeadForms(userId, pageId) {
    try {
      const connection = await pool.getConnection();
      let pageAccessToken;
      
      try {
        const [rows] = await connection.execute(
          `SELECT page_access_token FROM facebook_pages 
           WHERE user_id = ? AND page_id = ?`,
          [userId, pageId]
        );
        
        if (rows.length === 0) {
          throw new Error("Page not found or access token missing");
        }
        
        pageAccessToken = rows[0].page_access_token;
      } finally {
        connection.release();
      }

      const response = await axios.get(`${this.baseUrl}/${pageId}/leadgen_forms`, {
        params: {
          access_token: pageAccessToken,
          fields: 'id,name,status,questions'
        }
      });

      const forms = response.data.data || [];
      
      // Store forms in database
      const connection2 = await pool.getConnection();
      try {
        // Clear existing forms for this page and insert new ones
        await connection2.execute(
          `DELETE FROM facebook_lead_forms WHERE user_id = ? AND page_id = ?`,
          [userId, pageId]
        );

        for (const form of forms) {
          await connection2.execute(
            `INSERT INTO facebook_lead_forms (user_id, page_id, form_id, form_name, form_status, questions)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, pageId, form.id, form.name, form.status, JSON.stringify(form.questions || [])]
          );
        }
      } finally {
        connection2.release();
      }

      return forms;
    } catch (error) {
      console.error("Error fetching lead forms:", error.response?.data || error.message);
      throw error;
    }
  }

  // Subscribe to webhooks for a page
  async subscribeToWebhooks(userId, pageId, webhookUrl, verifyToken) {
    try {
      const connection = await pool.getConnection();
      let pageAccessToken;
      
      try {
        const [rows] = await connection.execute(
          `SELECT page_access_token FROM facebook_pages 
           WHERE user_id = ? AND page_id = ?`,
          [userId, pageId]
        );
        
        if (rows.length === 0) {
          throw new Error("Page not found or access token missing");
        }
        
        pageAccessToken = rows[0].page_access_token;
      } finally {
        connection.release();
      }

      // Subscribe to leadgen webhooks
      const response = await axios.post(`${this.baseUrl}/${pageId}/subscribed_apps`, {
        subscribed_fields: 'leadgen',
        access_token: pageAccessToken
      });

      // Store webhook subscription in database
      const connection2 = await pool.getConnection();
      try {
        await connection2.execute(
          `INSERT INTO facebook_webhooks (user_id, page_id, webhook_id, webhook_url, verify_token, subscribed_fields)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           webhook_url = VALUES(webhook_url),
           verify_token = VALUES(verify_token),
           subscribed_fields = VALUES(subscribed_fields),
           updated_at = NOW()`,
          [userId, pageId, `webhook_${pageId}`, webhookUrl, verifyToken, JSON.stringify(['leadgen'])]
        );
      } finally {
        connection2.release();
      }

      return response.data;
    } catch (error) {
      console.error("Error subscribing to webhooks:", error.response?.data || error.message);
      throw error;
    }
  }

  // Get leads from a form
  async getFormLeads(userId, formId) {
    try {
      const connection = await pool.getConnection();
      let pageAccessToken, pageId;
      
      try {
        const [rows] = await connection.execute(
          `SELECT fp.page_access_token, flf.page_id 
           FROM facebook_lead_forms flf
           JOIN facebook_pages fp ON flf.page_id = fp.page_id AND flf.user_id = fp.user_id
           WHERE flf.user_id = ? AND flf.form_id = ?`,
          [userId, formId]
        );
        
        if (rows.length === 0) {
          throw new Error("Form not found or access token missing");
        }
        
        pageAccessToken = rows[0].page_access_token;
        pageId = rows[0].page_id;
      } finally {
        connection.release();
      }

      const response = await axios.get(`${this.baseUrl}/${formId}/leads`, {
        params: {
          access_token: pageAccessToken,
          fields: 'id,created_time,field_data'
        }
      });

      return response.data.data || [];
    } catch (error) {
      console.error("Error fetching form leads:", error.response?.data || error.message);
      throw error;
    }
  }

  // Validate webhook signature
  validateWebhookSignature(payload, signature, appSecret) {
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('hex');
    
    return `sha256=${expectedSignature}` === signature;
  }
}

module.exports = new FacebookService();
