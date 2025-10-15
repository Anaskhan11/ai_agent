const axios = require("axios");
const pool = require("../../config/DBConnection");
const systemAuditLogger = require("../../utils/systemAuditLogger");
require("dotenv").config();

// Simulate Facebook lead webhook
const simulateFacebookLead = async (req, res) => {
  try {
    const { pageId, formId, leadData } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!pageId || !formId || !leadData) {
      return res.status(400).json({
        success: false,
        message: "Page ID, form ID, and lead data are required"
      });
    }

    // Validate that the user owns this page
    const connection = await pool.getConnection();
    try {
      const [pageRows] = await connection.execute(
        `SELECT user_id FROM facebook_pages WHERE page_id = ? AND user_id = ?`,
        [pageId, userId]
      );

      if (pageRows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Facebook page not found or not owned by user"
        });
      }
    } finally {
      connection.release();
    }

    // Create simulated webhook payload
    const webhookPayload = {
      object: 'page',
      entry: [{
        id: pageId,
        time: Math.floor(Date.now() / 1000),
        changes: [{
          field: 'leadgen',
          value: {
            leadgen_id: `test_lead_${Date.now()}`,
            form_id: formId,
            created_time: Math.floor(Date.now() / 1000),
            page_id: pageId,
            adgroup_id: 'test_adgroup_123',
            ad_id: 'test_ad_456'
          }
        }]
      }]
    };

    // Send webhook to our own endpoint
    const webhookUrl = `${process.env.BASE_URL || 'http://localhost:5000'}/api/webhooks/facebook`;
    
    try {
      await axios.post(webhookUrl, webhookPayload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Hub-Signature-256': 'test_signature' // In real scenario, this would be properly signed
        }
      });

      // Store the test lead data for retrieval
      const leadId = webhookPayload.entry[0].changes[0].value.leadgen_id;
      await storeTestLeadData(leadId, leadData);

      // Log successful webhook simulation
      await systemAuditLogger.logWebhookOperation(req, 'SIMULATE_FACEBOOK_LEAD',
        { leadId, pageId, formId, leadData }, true);

      res.status(200).json({
        success: true,
        message: "Facebook lead webhook simulated successfully",
        data: {
          leadId,
          webhookPayload
        }
      });
    } catch (webhookError) {
      console.error('Error sending webhook:', webhookError.message);

      // Log failed webhook simulation
      await systemAuditLogger.logWebhookOperation(req, 'SIMULATE_FACEBOOK_LEAD',
        { pageId, formId, leadData }, false, webhookError.message);

      res.status(500).json({
        success: false,
        message: "Failed to process webhook",
        error: webhookError.message
      });
    }
  } catch (error) {
    console.error("Error simulating Facebook lead:", error);
    res.status(500).json({
      success: false,
      message: "Failed to simulate Facebook lead",
      error: error.message
    });
  }
};

// Store test lead data for retrieval by webhook processor
const storeTestLeadData = async (leadId, leadData) => {
  try {
    const connection = await pool.getConnection();
    try {
      // Create a temporary table for test lead data if it doesn't exist
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS test_lead_data (
          lead_id VARCHAR(255) PRIMARY KEY,
          field_data JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 HOUR)
        )
      `);

      // Store test data
      const fieldData = Object.entries(leadData).map(([name, values]) => ({
        name,
        values: Array.isArray(values) ? values : [values]
      }));

      await connection.execute(
        `INSERT INTO test_lead_data (lead_id, field_data) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE field_data = VALUES(field_data)`,
        [leadId, JSON.stringify(fieldData)]
      );
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error storing test lead data:', error);
  }
};

// Get test lead data (used by webhook processor)
const getTestLeadData = async (leadId) => {
  try {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT field_data FROM test_lead_data 
         WHERE lead_id = ? AND expires_at > NOW()`,
        [leadId]
      );

      if (rows.length > 0) {
        return {
          id: leadId,
          created_time: new Date().toISOString(),
          field_data: JSON.parse(rows[0].field_data)
        };
      }
      return null;
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting test lead data:', error);
    return null;
  }
};

// Test complete webhook flow
const testCompleteWebhookFlow = async (req, res) => {
  try {
    const { pageId, formId, testContact } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID not found in token"
      });
    }

    if (!pageId || !formId || !testContact) {
      return res.status(400).json({
        success: false,
        message: "Page ID, form ID, and test contact data are required"
      });
    }

    const results = {
      steps: [],
      success: true,
      errors: []
    };

    // Step 1: Simulate lead generation
    results.steps.push({ step: 1, name: "Simulate Lead Generation", status: "starting" });
    
    try {
      const leadResponse = await simulateFacebookLead({
        body: { pageId, formId, leadData: testContact },
        user: { id: userId }
      }, { 
        status: () => ({ json: () => {} }),
        json: () => {}
      });
      
      results.steps[0].status = "completed";
      results.steps[0].data = { leadId: `test_lead_${Date.now()}` };
    } catch (error) {
      results.steps[0].status = "failed";
      results.steps[0].error = error.message;
      results.success = false;
      results.errors.push(`Step 1 failed: ${error.message}`);
    }

    // Step 2: Verify list creation
    results.steps.push({ step: 2, name: "Verify List Creation", status: "starting" });
    
    try {
      const connection = await pool.getConnection();
      try {
        const [listRows] = await connection.execute(
          `SELECT id, listName, contacts_count FROM lists 
           WHERE userId = ? AND listName LIKE '%Lead%' 
           ORDER BY createdAt DESC LIMIT 1`,
          [userId]
        );

        if (listRows.length > 0) {
          results.steps[1].status = "completed";
          results.steps[1].data = listRows[0];
        } else {
          results.steps[1].status = "failed";
          results.steps[1].error = "No list created";
          results.errors.push("Step 2 failed: No list created");
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      results.steps[1].status = "failed";
      results.steps[1].error = error.message;
      results.success = false;
      results.errors.push(`Step 2 failed: ${error.message}`);
    }

    // Step 3: Verify contact creation
    results.steps.push({ step: 3, name: "Verify Contact Creation", status: "starting" });
    
    try {
      const connection = await pool.getConnection();
      try {
        const [contactRows] = await connection.execute(
          `SELECT c.id, c.fullName, c.email, c.phoneNumber, l.listName 
           FROM contacts c 
           JOIN lists l ON c.listId = l.id 
           WHERE l.userId = ? AND c.email = ?
           ORDER BY c.createdAt DESC LIMIT 1`,
          [userId, testContact.email]
        );

        if (contactRows.length > 0) {
          results.steps[2].status = "completed";
          results.steps[2].data = contactRows[0];
        } else {
          results.steps[2].status = "failed";
          results.steps[2].error = "No contact created";
          results.errors.push("Step 3 failed: No contact created");
        }
      } finally {
        connection.release();
      }
    } catch (error) {
      results.steps[2].status = "failed";
      results.steps[2].error = error.message;
      results.success = false;
      results.errors.push(`Step 3 failed: ${error.message}`);
    }

    // Step 4: Check campaign creation (if configured)
    results.steps.push({ step: 4, name: "Check Campaign Creation", status: "starting" });
    
    if (process.env.DEFAULT_VAPI_PHONE_NUMBER_ID && process.env.DEFAULT_VAPI_ASSISTANT_ID) {
      try {
        const connection = await pool.getConnection();
        try {
          const [campaignRows] = await connection.execute(
            `SELECT campaign_created, campaign_id FROM facebook_leads 
             WHERE user_id = ? AND campaign_created = TRUE 
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
          );

          if (campaignRows.length > 0) {
            results.steps[3].status = "completed";
            results.steps[3].data = campaignRows[0];
          } else {
            results.steps[3].status = "skipped";
            results.steps[3].note = "No campaign created (may be expected if auto-campaign is disabled)";
          }
        } finally {
          connection.release();
        }
      } catch (error) {
        results.steps[3].status = "failed";
        results.steps[3].error = error.message;
        results.errors.push(`Step 4 failed: ${error.message}`);
      }
    } else {
      results.steps[3].status = "skipped";
      results.steps[3].note = "Campaign creation not configured (missing VAPI credentials)";
    }

    res.status(200).json({
      success: results.success,
      message: results.success ? "Webhook flow test completed successfully" : "Webhook flow test completed with errors",
      data: results
    });

  } catch (error) {
    console.error("Error testing complete webhook flow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to test webhook flow",
      error: error.message
    });
  }
};

module.exports = {
  simulateFacebookLead,
  testCompleteWebhookFlow,
  getTestLeadData
};
