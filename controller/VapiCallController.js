const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const systemAuditLogger = require('../utils/systemAuditLogger');
const CreditModel = require('../model/CreditModel/CreditModel');
const UsageTrackingModel = require('../model/CreditModel/UsageTrackingModel');
const { isSuperAdmin, getCreditCost } = require('../middleware/creditMiddleware');

class VapiCallController {
  constructor() {
    this.vapiApiKey = process.env.VAPI_PRIVATE_API_KEY;
    this.vapiBaseUrl = 'https://api.vapi.ai';
    
    if (!this.vapiApiKey) {
      console.warn('⚠️ VAPI_PRIVATE_API_KEY not found in environment variables');
    }
  }

  // Create a phone call using VAPI
  async createCall(req, res) {
    try {
      const { workflowId, assistantId, customer, metadata = {} } = req.body;
      const userId = req.user?.id;

      console.log('🔥 Creating VAPI phone call:', {
        workflowId,
        assistantId,
        customer,
        metadata
      });

      if (!customer?.number) {
        return res.status(400).json({
          success: false,
          message: 'Customer phone number is required'
        });
      }

      // Check credits before making the call (unless super admin)
      if (!(await isSuperAdmin(userId))) {
        const callInitiationCost = await getCreditCost('vapi_call', 'per_call');
        const hasSufficientCredits = await CreditModel.checkSufficientCredits(userId, callInitiationCost);

        if (!hasSufficientCredits) {
          const balance = await CreditModel.getUserCreditBalance(userId);
          return res.status(402).json({
            success: false,
            message: 'Insufficient credits for VAPI call',
            error_code: 'INSUFFICIENT_CREDITS',
            details: {
              required_credits: callInitiationCost,
              available_credits: balance?.available_credits || 0,
              operation_type: 'vapi_call'
            },
            actions: {
              purchase_credits: '/api/credits/packages'
            }
          });
        }
      }

      // Prepare VAPI call request
      let callRequest = {
        customer: {
          number: customer.number,
          name: customer.name || 'Customer'
        },
        metadata: {
          userId,
          workflowId,
          ...metadata
        }
      };

      // Use assistantId if provided, otherwise use workflowId
      if (assistantId) {
        callRequest.assistantId = assistantId;
      } else if (workflowId) {
        // If no assistantId, we'll need to create an assistant from workflow
        // For now, we'll use a default assistant configuration
        callRequest.assistant = {
          model: {
            provider: "openai",
            model: "gpt-4o",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content: `You are an AI assistant making a phone call for workflow ${workflowId}. Be professional, friendly, and helpful. Keep responses concise and natural for phone conversation.`
              }
            ]
          },
          voice: {
            provider: "11labs",
            voiceId: "21m00Tcm4TlvDq8ikWAM"
          },
          firstMessage: "Hello! This is an AI assistant calling regarding your request. How can I help you today?"
        };
      } else {
        return res.status(400).json({
          success: false,
          message: 'Either workflowId or assistantId is required'
        });
      }

      console.log('📞 VAPI call request:', JSON.stringify(callRequest, null, 2));

      // Make request to VAPI
      const vapiResponse = await axios.post(
        `${this.vapiBaseUrl}/call`,
        callRequest,
        {
          headers: {
            'Authorization': `Bearer ${this.vapiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ VAPI call created successfully:', vapiResponse.data);

      // Deduct credits for call initiation (unless super admin)
      if (!(await isSuperAdmin(userId))) {
        try {
          const callInitiationCost = await getCreditCost('vapi_call', 'per_call');

          await CreditModel.deductCreditsFromUser(
            userId,
            callInitiationCost,
            'vapi_call',
            vapiResponse.data.id,
            'VAPI call initiation',
            {
              call_id: vapiResponse.data.id,
              customer_number: customer.number,
              assistant_id: assistantId,
              workflow_id: workflowId
            }
          );

          // Create usage tracking record
          await UsageTrackingModel.createUsageRecord({
            user_id: userId,
            operation_type: 'vapi_call',
            operation_id: vapiResponse.data.id,
            credits_consumed: callInitiationCost,
            unit_cost: callInitiationCost,
            units_consumed: 1,
            unit_type: 'calls',
            operation_details: {
              call_id: vapiResponse.data.id,
              customer_number: customer.number,
              assistant_id: assistantId,
              workflow_id: workflowId,
              endpoint: req.path
            },
            status: 'completed'
          });

          console.log(`💰 Credits deducted: ${callInitiationCost} credits for VAPI call initiation`);
        } catch (creditError) {
          console.error('Error deducting credits:', creditError);
          // Don't fail the call if credit deduction fails, but log it
        }
      }

      // Log successful VAPI call
      await systemAuditLogger.logVAPICall(req, 'CREATE_CALL', '/call', callRequest, vapiResponse.data, true);

      res.json({
        success: true,
        data: vapiResponse.data,
        message: 'Phone call initiated successfully'
      });

    } catch (error) {
      console.error('❌ Error creating VAPI call:', error);

      let errorMessage = 'Failed to create phone call';
      let statusCode = 500;

      if (error.response) {
        console.error('VAPI API Error Response:', error.response.data);
        errorMessage = error.response.data?.message || errorMessage;
        statusCode = error.response.status;
      }

      // Log failed VAPI call
      await systemAuditLogger.logVAPICall(req, 'CREATE_CALL', '/call', callRequest, error.response?.data, false, errorMessage);

      res.status(statusCode).json({
        success: false,
        message: errorMessage,
        error: error.response?.data || error.message
      });
    }
  }

  // Get call details
  async getCall(req, res) {
    try {
      const { callId } = req.params;

      const vapiResponse = await axios.get(
        `${this.vapiBaseUrl}/call/${callId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.vapiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.json({
        success: true,
        data: vapiResponse.data
      });

    } catch (error) {
      console.error('❌ Error getting VAPI call:', error);
      
      let errorMessage = 'Failed to get call details';
      let statusCode = 500;

      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        statusCode = error.response.status;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage
      });
    }
  }

  // List calls
  async listCalls(req, res) {
    try {
      const { assistantId, workflowId, limit = 50, offset = 0 } = req.query;
      
      let params = {
        limit: parseInt(limit),
        offset: parseInt(offset)
      };

      if (assistantId) params.assistantId = assistantId;

      const vapiResponse = await axios.get(
        `${this.vapiBaseUrl}/call`,
        {
          headers: {
            'Authorization': `Bearer ${this.vapiApiKey}`,
            'Content-Type': 'application/json'
          },
          params
        }
      );

      // Filter by workflowId if provided (since VAPI doesn't support this filter directly)
      let calls = vapiResponse.data;
      if (workflowId && Array.isArray(calls)) {
        calls = calls.filter(call => call.metadata?.workflowId === workflowId);
      }

      res.json({
        success: true,
        data: calls
      });

    } catch (error) {
      console.error('❌ Error listing VAPI calls:', error);
      
      let errorMessage = 'Failed to list calls';
      let statusCode = 500;

      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        statusCode = error.response.status;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage
      });
    }
  }

  // End a call
  async endCall(req, res) {
    try {
      const { callId } = req.params;

      const vapiResponse = await axios.post(
        `${this.vapiBaseUrl}/call/${callId}/end`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${this.vapiApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.json({
        success: true,
        data: vapiResponse.data,
        message: 'Call ended successfully'
      });

    } catch (error) {
      console.error('❌ Error ending VAPI call:', error);
      
      let errorMessage = 'Failed to end call';
      let statusCode = 500;

      if (error.response) {
        errorMessage = error.response.data?.message || errorMessage;
        statusCode = error.response.status;
      }

      res.status(statusCode).json({
        success: false,
        message: errorMessage
      });
    }
  }
}

module.exports = new VapiCallController();
