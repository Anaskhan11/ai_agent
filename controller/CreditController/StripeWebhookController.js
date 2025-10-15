const StripeService = require('../../services/StripeService');
const systemAuditLogger = require('../../utils/systemAuditLogger');

// Handle Stripe webhooks
const handleStripeWebhook = async (req, res) => {
  let event;
  
  try {
    // Get the signature from headers
    const signature = req.headers['stripe-signature'];
    
    if (!signature) {
      console.error('Missing Stripe signature header');
      return res.status(400).json({
        success: false,
        message: 'Missing Stripe signature'
      });
    }

    // Verify webhook signature and construct event
    event = StripeService.verifyWebhookSignature(req.body, signature);
    
    console.log(`Received Stripe webhook: ${event.type}`);
    
    // Log webhook receipt
    await systemAuditLogger.logSystemOperation(
      req, 
      'WEBHOOK_RECEIVED', 
      'stripe_webhooks', 
      event.id,
      null,
      {
        success: true,
        externalApi: 'Stripe',
        newValues: {
          event_type: event.type,
          event_id: event.id,
          created: event.created
        }
      }
    );

  } catch (error) {
    console.error('Webhook signature verification failed:', error.message);
    
    // Log failed webhook
    await systemAuditLogger.logSystemOperation(
      req, 
      'WEBHOOK_FAILED', 
      'stripe_webhooks', 
      null,
      null,
      {
        success: false,
        errorMessage: error.message,
        externalApi: 'Stripe'
      }
    );
    
    return res.status(400).json({
      success: false,
      message: 'Invalid webhook signature',
      error: error.message
    });
  }

  try {
    // Process the webhook event
    const result = await StripeService.processWebhookEvent(event);
    
    // Log successful processing
    await systemAuditLogger.logSystemOperation(
      req, 
      'WEBHOOK_PROCESSED', 
      'stripe_webhooks', 
      event.id,
      null,
      {
        success: true,
        externalApi: 'Stripe',
        newValues: {
          event_type: event.type,
          processing_result: result
        }
      }
    );

    console.log(`Webhook processed successfully: ${event.type}`);
    
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      event_type: event.type,
      event_id: event.id
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    
    // Log processing error
    await systemAuditLogger.logSystemOperation(
      req, 
      'WEBHOOK_ERROR', 
      'stripe_webhooks', 
      event.id,
      null,
      {
        success: false,
        errorMessage: error.message,
        externalApi: 'Stripe',
        newValues: {
          event_type: event.type,
          error_details: error.message
        }
      }
    );

    res.status(500).json({
      success: false,
      message: 'Error processing webhook',
      error: error.message,
      event_type: event.type,
      event_id: event.id
    });
  }
};

// Test webhook endpoint (for development)
const testWebhook = async (req, res) => {
  try {
    const { event_type = 'payment_intent.succeeded', payment_intent_id } = req.body;
    
    if (!payment_intent_id) {
      return res.status(400).json({
        success: false,
        message: 'payment_intent_id is required for testing'
      });
    }

    // Create a mock event for testing
    const mockEvent = {
      id: `evt_test_${Date.now()}`,
      type: event_type,
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: payment_intent_id,
          status: event_type === 'payment_intent.succeeded' ? 'succeeded' : 'failed',
          last_payment_error: event_type === 'payment_intent.payment_failed' ? 
            { message: 'Test failure' } : null
        }
      }
    };

    const result = await StripeService.processWebhookEvent(mockEvent);
    
    res.json({
      success: true,
      message: 'Test webhook processed',
      event: mockEvent,
      result: result
    });

  } catch (error) {
    console.error('Error processing test webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing test webhook',
      error: error.message
    });
  }
};

// Get webhook logs (for debugging)
const getWebhookLogs = async (req, res) => {
  try {
    const { page = 1, limit = 20, event_type } = req.query;
    const offset = (page - 1) * limit;
    
    const pool = require('../../config/DBConnection');
    let sql = `
      SELECT 
        id,
        operation_type,
        metadata,
        response_status,
        error_message,
        created_at
      FROM audit_logs 
      WHERE table_name = 'stripe_webhooks'
    `;
    const params = [];

    if (event_type) {
      sql += ` AND JSON_EXTRACT(metadata, '$.system_details.newValues.event_type') = ?`;
      params.push(event_type);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [rows] = await pool.execute(sql, params);

    // Get total count
    let countSql = `SELECT COUNT(*) as total FROM audit_logs WHERE table_name = 'stripe_webhooks'`;
    const countParams = [];
    
    if (event_type) {
      countSql += ` AND JSON_EXTRACT(metadata, '$.system_details.newValues.event_type') = ?`;
      countParams.push(event_type);
    }

    const [countRows] = await pool.execute(countSql, countParams);
    const total = countRows[0].total;

    res.json({
      success: true,
      data: {
        logs: rows.map(row => ({
          ...row,
          metadata: row.metadata ? JSON.parse(row.metadata) : null
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting webhook logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get webhook logs',
      error: error.message
    });
  }
};

// Retry failed webhook processing
const retryWebhook = async (req, res) => {
  try {
    const { event_id } = req.params;
    
    if (!event_id) {
      return res.status(400).json({
        success: false,
        message: 'Event ID is required'
      });
    }

    // This would typically retrieve the event from Stripe and reprocess it
    // For now, we'll return a placeholder response
    res.json({
      success: true,
      message: 'Webhook retry functionality not yet implemented',
      event_id: event_id
    });

  } catch (error) {
    console.error('Error retrying webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrying webhook',
      error: error.message
    });
  }
};

module.exports = {
  handleStripeWebhook,
  testWebhook,
  getWebhookLogs,
  retryWebhook
};
