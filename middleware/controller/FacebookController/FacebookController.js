const FacebookService = require("../../services/FacebookService");
const pool = require("../../config/DBConnection");

// Get user's Facebook pages
const getUserPages = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const pages = await FacebookService.getUserPages(userId);
    
    res.status(200).json({
      success: true,
      message: "Facebook pages retrieved successfully",
      data: pages
    });
  } catch (error) {
    console.error("Error fetching Facebook pages:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch Facebook pages",
      error: error.message
    });
  }
};

// Get lead forms for a specific page
const getPageLeadForms = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pageId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }
    
    if (!pageId) {
      return res.status(400).json({
        success: false,
        message: "Page ID is required"
      });
    }
    
    const forms = await FacebookService.getPageLeadForms(userId, pageId);
    
    res.status(200).json({
      success: true,
      message: "Lead forms retrieved successfully",
      data: forms
    });
  } catch (error) {
    console.error("Error fetching lead forms:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch lead forms",
      error: error.message
    });
  }
};

// Get leads from a specific form
const getFormLeads = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { formId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!formId) {
      return res.status(400).json({
        success: false,
        message: "Form ID is required"
      });
    }
    
    const leads = await FacebookService.getFormLeads(userId, formId);
    
    res.status(200).json({
      success: true,
      message: "Form leads retrieved successfully",
      data: leads
    });
  } catch (error) {
    console.error("Error fetching form leads:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch form leads",
      error: error.message
    });
  }
};

// Subscribe to webhooks for a page
const subscribeToWebhooks = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pageId, webhookUrl, verifyToken } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!pageId || !webhookUrl || !verifyToken) {
      return res.status(400).json({
        success: false,
        message: "Page ID, webhook URL, and verify token are required"
      });
    }
    
    const result = await FacebookService.subscribeToWebhooks(userId, pageId, webhookUrl, verifyToken);

    // Persist selection into webhook metadata if context provided
    try {
      const { webhookId, formId } = req.body || {};
      if (webhookId && formId) {
        const connection2 = await pool.getConnection();
        try {
          const [rows] = await connection2.execute(
            `SELECT metadata FROM webhooks WHERE webhook_id = ? AND user_id = ?`,
            [webhookId, userId]
          );
          let metadata = {};
          if (rows.length > 0) {
            try { metadata = JSON.parse(rows[0].metadata || '{}'); } catch {}
          }
          metadata.facebook = { pageId, formId };
          await connection2.execute(
            `UPDATE webhooks SET metadata = ?, updated_at = NOW() WHERE webhook_id = ? AND user_id = ?`,
            [JSON.stringify(metadata), webhookId, userId]
          );
        } finally {
          connection2.release();
        }
      }
    } catch (e) {
      // Non-fatal persistence error
      console.log('Warning: failed to persist facebook selection to webhook metadata:', e.message);
    }
    
    res.status(200).json({
      success: true,
      message: "Successfully subscribed to webhooks",
      data: result
    });
  } catch (error) {
    console.error("Error subscribing to webhooks:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to subscribe to webhooks",
      error: error.message
    });
  }
};

// Get stored Facebook pages from database
const getStoredPages = async (req, res) => {
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
      const [rows] = await connection.execute(
        `SELECT page_id, page_name, page_category, is_active, created_at
         FROM facebook_pages
         WHERE user_id = ? AND is_active = 1
         ORDER BY page_name`,
        [userId]
      );

      // Map database fields to frontend expected format
      const mappedPages = rows.map(row => ({
        id: row.page_id,
        name: row.page_name,
        category: row.page_category,
        is_active: row.is_active,
        created_at: row.created_at
      }));

      res.status(200).json({
        success: true,
        message: "Stored Facebook pages retrieved successfully",
        data: mappedPages
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error fetching stored pages:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stored pages",
      error: error.message
    });
  }
};

// Get stored lead forms from database
const getStoredLeadForms = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { pageId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    const connection = await pool.getConnection();
    try {
      let query = `SELECT form_id, form_name, form_status, questions, created_at
                   FROM facebook_lead_forms 
                   WHERE user_id = ?`;
      let params = [userId];
      
      if (pageId) {
        query += ` AND page_id = ?`;
        params.push(pageId);
      }
      
      query += ` ORDER BY form_name`;
      
      const [rows] = await connection.execute(query, params);
      
      // Parse questions JSON and map to frontend format
      const forms = rows.map(row => ({
        id: row.form_id,
        name: row.form_name,
        status: row.form_status,
        page_id: row.page_id,
        questions: row.questions ? JSON.parse(row.questions) : [],
        created_at: row.created_at
      }));
      
      res.status(200).json({
        success: true,
        message: "Stored lead forms retrieved successfully",
        data: forms
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Error fetching stored lead forms:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch stored lead forms",
      error: error.message
    });
  }
};

// Test Facebook connection
const testFacebookConnection = async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    // Try to fetch pages to test connection
    const pages = await FacebookService.getUserPages(userId);
    
    res.status(200).json({
      success: true,
      message: "Facebook connection test successful",
      data: {
        pagesCount: pages.length,
        pages: pages.slice(0, 3) // Return first 3 pages as sample
      }
    });
  } catch (error) {
    console.error("Facebook connection test failed:", error.message);
    res.status(500).json({
      success: false,
      message: "Facebook connection test failed",
      error: error.message
    });
  }
};

module.exports = {
  getUserPages,
  getPageLeadForms,
  getFormLeads,
  subscribeToWebhooks,
  getStoredPages,
  getStoredLeadForms,
  testFacebookConnection
};
