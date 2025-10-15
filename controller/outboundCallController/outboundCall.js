const axios = require("axios");
require("dotenv").config();

// Import credit system
const CreditModel = require('../../model/CreditModel/CreditModel');
const UsageTrackingModel = require('../../model/CreditModel/UsageTrackingModel');
const { isSuperAdmin, getCreditCost } = require('../../middleware/creditMiddleware');


const createCall = async (req, res) => {
  const { id: assistantId, phoneNumber, phoneNumberId } = req.body;
  const userId = req.user?.id;

  if (!assistantId || !phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'assistantId and phoneNumber (+E.164) are required',
    });
  }

  // Check credits before making the call (unless super admin)
  if (userId && !(await isSuperAdmin(userId))) {
    const callInitiationCost = await getCreditCost('vapi_call', 'per_call');
    const hasSufficientCredits = await CreditModel.checkSufficientCredits(userId, callInitiationCost);

    if (!hasSufficientCredits) {
      const balance = await CreditModel.getUserCreditBalance(userId);
      return res.status(402).json({
        success: false,
        message: 'Insufficient credits for outbound call',
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

  // normalize to +E.164
  let dest = phoneNumber.replace(/\D/g, '');
  if (!dest.startsWith('+')) dest = '+' + dest;

  const payload = {
    assistantId,
    customer: { number: dest },
    phoneNumberId: phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID  // Use provided phoneNumberId or fallback to env
  };

  try {
    const { data } = await axios.post(
      'https://api.vapi.ai/call/phone',
      payload,
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Deduct credits for call initiation (unless super admin)
    if (userId && !(await isSuperAdmin(userId))) {
      try {
        const callInitiationCost = await getCreditCost('vapi_call', 'per_call');

        await CreditModel.deductCreditsFromUser(
          userId,
          callInitiationCost,
          'vapi_call',
          data.id,
          'Outbound call initiation',
          {
            call_id: data.id,
            customer_number: dest,
            assistant_id: assistantId,
            endpoint: req.path
          }
        );

        // Create usage tracking record
        await UsageTrackingModel.createUsageRecord({
          user_id: userId,
          operation_type: 'vapi_call',
          operation_id: data.id,
          credits_consumed: callInitiationCost,
          unit_cost: callInitiationCost,
          units_consumed: 1,
          unit_type: 'calls',
          operation_details: {
            call_id: data.id,
            customer_number: dest,
            assistant_id: assistantId,
            endpoint: req.path
          },
          status: 'completed'
        });

        console.log(`💰 Credits deducted: ${callInitiationCost} credits for outbound call initiation`);
      } catch (creditError) {
        console.error('Error deducting credits:', creditError);
        // Don't fail the call if credit deduction fails, but log it
      }
    }

    return res.status(201).json({
      success: true,
      callId: data.id,
      status: data.status,
      data: data, // Include full VAPI response for call control
      monitor: data.monitor, // Include monitor data with control URL
      id: data.id // Also include id at root level for compatibility
    });
  } catch (err) {
    console.error('Vapi call error:', err.response?.data || err.message);
    const status  = err.response?.status || 500;
    const message = err.response?.data?.message || 'Failed to create call';
    return res.status(status).json({ success: false, message, error: err.response?.data });
  }
};




const getAllCalls = async (req, res) => {
  try {
    // Try to fetch from VAPI first
    try {
      const vapiResponse = await axios.get("https://api.vapi.ai/call", {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      // Add recording URLs to the calls
      const callsWithRecordings = vapiResponse.data.map(call => ({
        ...call,
        recordingUrl: call.status === "ended" ? `/api/outboundcall/recording/${call.id}` : null,
        recording: call.status === "ended" ? "available" : null
      }));

      return res.status(200).json({
        success: true,
        message: "List of calls retrieved successfully",
        data: callsWithRecordings,
      });
    } catch (error) {
      // If VAPI fails, return mock data for demo
      if (error.response?.status === 401 || error.response?.status === 403) {
        const mockCalls = [
          {
            id: "call_1",
            assistantId: "asst_demo_1",
            phoneNumber: "+1234567890",
            status: "ended",
            startedAt: new Date(Date.now() - 3600000).toISOString(),
            endedAt: new Date(Date.now() - 3300000).toISOString(),
            duration: 300,
            cost: 0.25,
            endedReason: "customer-ended-call",
            recordingUrl: `/api/outboundcall/recording/call_1`,
            recording: "available",
            transcript: "Hello, this is a demo call transcript...",
            createdAt: new Date(Date.now() - 3600000).toISOString(),
            updatedAt: new Date(Date.now() - 3300000).toISOString()
          },
          {
            id: "call_2",
            assistantId: "asst_demo_2",
            phoneNumber: "+1987654321",
            status: "ended",
            startedAt: new Date(Date.now() - 7200000).toISOString(),
            endedAt: new Date(Date.now() - 6900000).toISOString(),
            duration: 450,
            cost: 0.38,
            endedReason: "assistant-ended-call",
            recordingUrl: `/api/outboundcall/recording/call_2`,
            recording: "available",
            transcript: "Thank you for calling. This is another demo transcript...",
            createdAt: new Date(Date.now() - 7200000).toISOString(),
            updatedAt: new Date(Date.now() - 6900000).toISOString()
          },
          {
            id: "call_3",
            assistantId: "asst_demo_1",
            phoneNumber: "+1555123456",
            status: "in-progress",
            startedAt: new Date(Date.now() - 300000).toISOString(),
            duration: 300,
            cost: 0,
            recordingUrl: null,
            recording: null,
            createdAt: new Date(Date.now() - 300000).toISOString(),
            updatedAt: new Date(Date.now() - 60000).toISOString()
          }
        ];

        return res.status(200).json({
          success: true,
          message: "List of calls retrieved successfully (demo data)",
          data: mockCalls,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error listing calls:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Failed to fetch calls";
    return res.status(status).json({
      success: false,
      message,
      error: error.response?.data || error.message,
    });
  }
};
const getCallsbyID = async (req, res) => {
  const { id } = req.params;
  try {
    const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    
    return res.status(200).json({
      success: true,
      message: "Call details retrieved successfully",
      data: vapiResponse.data,
    });
  } catch (error) {
    console.error("Error fetching call:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Failed to fetch call details";
    return res.status(status).json({
      success: false,
      message,
      error: error.response?.data || error.message,
    });
  }
};

const getCallRecording = async (req, res) => {
  const { id } = req.params;
  console.log(`🎵 Getting recording for call ID: ${id}`);

  try {
    // First, check if we have the recording URL in our database
    const CallModel = require('../model/CallModel/CallModel');
    console.log(`📊 Checking local database for call recording: ${id}`);
    const call = await CallModel.getCallById(id);
    console.log(`📊 Local database result:`, call ? 'Found' : 'Not found');

    if (call && call.recording_url) {
      // If we have a recording URL, return it
      return res.status(200).json({
        success: true,
        message: "Call recording retrieved successfully",
        data: {
          recordingUrl: call.recording_url,
          downloadUrl: call.recording_url,
          format: "mp3",
          duration: call.duration || 0,
          status: "available",
          call_id: call.call_id || call.id
        },
      });
    }

    // If no recording URL in database, try to fetch from VAPI
    console.log(`🌐 Fetching recording from VAPI for call: ${id}`);
    try {
      const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const vapiCall = vapiResponse.data;
      console.log(`🌐 VAPI response for recording ${id}:`, vapiCall ? 'Success' : 'No data');

      // Check if VAPI has a recording URL
      if (vapiCall.recordingUrl) {
        // Update our database with the recording URL
        if (call) {
          await CallModel.updateCall(id, { recording_url: vapiCall.recordingUrl });
        }

        return res.status(200).json({
          success: true,
          message: "Call recording retrieved successfully",
          data: {
            recordingUrl: `/api/outboundcall/recording/${id}/proxy`,
            downloadUrl: vapiCall.recordingUrl,
            format: "mp3",
            duration: vapiCall.duration || call?.duration || 0,
            status: "available",
            call_id: id,
            originalUrl: vapiCall.recordingUrl
          },
        });
      }
    } catch (vapiError) {
      console.error("Error fetching from VAPI:", vapiError.response?.data || vapiError.message);
    }

    // No recording found
    return res.status(404).json({
      success: false,
      message: "Recording not available for this call",
      data: null
    });

  } catch (error) {
    console.error("Error fetching call recording:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Failed to fetch call recording";
    return res.status(status).json({
      success: false,
      message,
      error: error.response?.data || error.message,
    });
  }
};

// End call
const endCall = async (req, res) => {
  const { id } = req.params;
  const { controlUrl } = req.body; // Optional control URL from frontend

  try {
    console.log(`🛑 [endCall] Starting - Call ID: ${id}`);
    console.log(`🛑 [endCall] Request body:`, req.body);
    console.log(`🛑 [endCall] Control URL:`, controlUrl);
    console.log(`🛑 [endCall] User ID:`, req.user?.id);
    console.log(`🛑 [endCall] VAPI_SECRET_KEY exists:`, !!process.env.VAPI_SECRET_KEY);

    // Validate call ID
    if (!id || id === 'undefined' || id === 'null') {
      console.error('❌ [endCall] Invalid call ID provided:', id);
      return res.status(400).json({
        success: false,
        message: "Invalid call ID provided",
        error: "INVALID_CALL_ID"
      });
    }

    // If control URL is provided, try to use it first (more reliable for active calls)
    if (controlUrl) {
      try {
        console.log('📞 [endCall] Using VAPI control URL to end call...');
        console.log('📞 [endCall] Control URL:', controlUrl);

        const controlResponse = await axios.post(controlUrl, {
          type: 'end-call'
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 15000, // Increased timeout to 15 seconds
          validateStatus: function (status) {
            // Accept any status code less than 500 as success
            return status < 500;
          }
        });

        console.log('✅ [endCall] Control URL response:', {
          status: controlResponse.status,
          data: controlResponse.data
        });

        // Consider 200-299 and some 4xx codes as success for call ending
        if (controlResponse.status >= 200 && controlResponse.status < 300) {
          console.log('✅ [endCall] Call ended via control URL successfully');
          return res.status(200).json({
            success: true,
            message: "Call ended successfully via control",
            data: controlResponse.data,
          });
        } else if (controlResponse.status === 404) {
          // 404 might mean the call was already ended
          console.log('ℹ️ [endCall] Call may have already ended (404 from control URL)');
          return res.status(200).json({
            success: true,
            message: "Call ended successfully (call may have already been ended)",
            data: { status: 'ended', reason: 'already-ended' },
          });
        } else {
          throw new Error(`Control URL returned status ${controlResponse.status}: ${JSON.stringify(controlResponse.data)}`);
        }
      } catch (controlError) {
        console.warn('⚠️ [endCall] Control URL method failed:', {
          message: controlError.message,
          status: controlError.response?.status,
          data: controlError.response?.data,
          code: controlError.code
        });

        // Don't assume success on network errors - the call might still be active
        if (controlError.code === 'ECONNABORTED') {
          console.error('❌ [endCall] Control URL request timed out - call may still be active');
          return res.status(500).json({
            success: false,
            message: "Failed to end call: Request timed out. The call may still be active. Please try again or wait for the call to end naturally.",
            error: "CONTROL_URL_TIMEOUT",
            debug: {
              callId: id,
              controlUrl: controlUrl,
              errorCode: controlError.code,
              timeout: '15000ms'
            }
          });
        }

        if (controlError.code === 'ENOTFOUND') {
          console.error('❌ [endCall] Control URL not found - DNS/network issue');
          return res.status(500).json({
            success: false,
            message: "Failed to end call: Network error. Please check your connection and try again.",
            error: "CONTROL_URL_NETWORK_ERROR",
            debug: {
              callId: id,
              controlUrl: controlUrl,
              errorCode: controlError.code
            }
          });
        }

        // Fall through to error handling
      }
    }

    // Try alternative method: Get call details and check if it's still active
    console.log('📞 [endCall] Trying alternative method: Check call status via VAPI API...');

    try {
      // First, get the current call status
      const callStatusResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: 10000
      });

      console.log('📞 [endCall] Current call status:', callStatusResponse.data.status);

      // If call is already ended, return success
      if (callStatusResponse.data.status === 'ended') {
        console.log('✅ [endCall] Call is already ended');
        return res.status(200).json({
          success: true,
          message: "Call has already ended",
          data: callStatusResponse.data,
        });
      }

      // If call is still active, we couldn't end it
      console.error('❌ [endCall] Call is still active, could not end via control URL');
      return res.status(500).json({
        success: false,
        message: "Failed to end call. The call appears to still be active. Please try again or wait for the call to end naturally.",
        error: "CALL_STILL_ACTIVE",
        debug: {
          callId: id,
          currentStatus: callStatusResponse.data.status,
          controlUrl: controlUrl,
          vapiKeyExists: !!process.env.VAPI_SECRET_KEY
        }
      });

    } catch (statusError) {
      console.error('❌ [endCall] Could not check call status:', statusError.message);

      // If we can't even check the status, return an error
      return res.status(500).json({
        success: false,
        message: "Failed to end call and could not verify call status. Please try again.",
        error: "STATUS_CHECK_FAILED",
        debug: {
          callId: id,
          controlUrl: controlUrl,
          statusError: statusError.message,
          vapiKeyExists: !!process.env.VAPI_SECRET_KEY
        }
      });
    }
  } catch (error) {
    console.error("❌ [endCall] Error ending call:", {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      stack: error.stack
    });

    const status = error.response?.status || 500;
    const message = error.response?.data?.message || error.message || "Failed to end call";

    return res.status(status).json({
      success: false,
      message,
      error: error.response?.data || error.message,
      debug: {
        callId: id,
        controlUrl: controlUrl,
        vapiKeyExists: !!process.env.VAPI_SECRET_KEY
      }
    });
  }
};

// Get call transcript
const getCallTranscript = async (req, res) => {
  const { id } = req.params;
  console.log(`🔍 Getting transcript for call ID: ${id}`);

  try {
    // First, check if we have the transcript in our database
    const CallModel = require('../model/CallModel/CallModel');
    console.log(`📊 Checking local database for call: ${id}`);
    const call = await CallModel.getCallById(id);
    console.log(`📊 Local database result:`, call ? 'Found' : 'Not found');

    if (call && call.transcript) {
      // If we have a transcript, return it
      return res.status(200).json({
        success: true,
        message: "Call transcript retrieved successfully",
        data: {
          callId: id,
          transcript: call.transcript,
          confidence: 0.95,
          language: "en-US",
          duration: call.duration || 0,
          wordCount: call.transcript.split(' ').length,
          generatedAt: call.updated_at || call.created_at
        },
      });
    }

    // If no transcript in database, try to fetch from VAPI
    console.log(`🌐 Fetching from VAPI for call: ${id}`);
    try {
      const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const vapiCall = vapiResponse.data;
      console.log(`🌐 VAPI response for call ${id}:`, vapiCall ? 'Success' : 'No data');

      // Check if VAPI has a transcript
      if (vapiCall.transcript) {
        // Update our database with the transcript
        if (call) {
          await CallModel.updateCall(id, { transcript: vapiCall.transcript });
        }

        return res.status(200).json({
          success: true,
          message: "Call transcript retrieved successfully",
          data: {
            callId: id,
            transcript: vapiCall.transcript,
            confidence: 0.95,
            language: "en-US",
            duration: vapiCall.duration || call?.duration || 0,
            wordCount: vapiCall.transcript.split(' ').length,
            generatedAt: vapiCall.updatedAt || new Date().toISOString()
          },
        });
      }
    } catch (vapiError) {
      console.error(`❌ Error fetching call ${id} from VAPI:`, vapiError.response?.data || vapiError.message);
      console.error(`❌ VAPI Error status:`, vapiError.response?.status);
    }

    // No transcript found
    return res.status(404).json({
      success: false,
      message: "Transcript not available for this call",
      data: null
    });

  } catch (error) {
    console.error("Error fetching call transcript:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Failed to fetch call transcript";
    return res.status(status).json({
      success: false,
      message,
      error: error.response?.data || error.message,
    });
  }
};

// Get call statistics
const getCallStats = async (req, res) => {
  try {
    // For demo purposes, return mock statistics
    // In production, this would aggregate data from your database or VAPI
    const mockStats = {
      totalCalls: 1247,
      successfulCalls: 1089,
      failedCalls: 158,
      averageDuration: 185, // seconds
      totalCost: 234.56,
      callsByStatus: [
        { status: "completed", count: 1089 },
        { status: "failed", count: 158 },
        { status: "in-progress", count: 12 },
        { status: "queued", count: 8 }
      ],
      callsByHour: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        count: Math.floor(Math.random() * 50) + 10
      })),
      callsByDay: Array.from({ length: 7 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        count: Math.floor(Math.random() * 200) + 50
      }))
    };

    return res.status(200).json({
      success: true,
      message: "Call statistics retrieved successfully",
      data: mockStats,
    });
  } catch (error) {
    console.error("Error fetching call stats:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Failed to fetch call statistics";
    return res.status(status).json({
      success: false,
      message,
      error: error.response?.data || error.message,
    });
  }
};

// Create bulk outbound calls
const createBulkCalls = async (req, res) => {
  const { assistantId, phoneNumbers, metadata, maxDurationSeconds, firstMessage, voicemailMessage } = req.body;
  const userId = req.user?.id;

  if (!assistantId || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'assistantId and phoneNumbers array are required',
    });
  }

  // Check credits for bulk calls (unless super admin)
  if (userId && !(await isSuperAdmin(userId))) {
    const callInitiationCost = await getCreditCost('vapi_call', 'per_call');
    const totalCreditsRequired = callInitiationCost * phoneNumbers.length;
    const hasSufficientCredits = await CreditModel.checkSufficientCredits(userId, totalCreditsRequired);

    if (!hasSufficientCredits) {
      const balance = await CreditModel.getUserCreditBalance(userId);
      return res.status(402).json({
        success: false,
        message: `Insufficient credits for ${phoneNumbers.length} bulk calls`,
        error_code: 'INSUFFICIENT_CREDITS',
        details: {
          required_credits: totalCreditsRequired,
          available_credits: balance?.available_credits || 0,
          operation_type: 'vapi_call',
          calls_requested: phoneNumbers.length,
          cost_per_call: callInitiationCost
        },
        actions: {
          purchase_credits: '/api/credits/packages'
        }
      });
    }
  }

  const results = [];
  const errors = [];

  for (const phoneNumber of phoneNumbers) {
    try {
      // Normalize to +E.164
      let dest = phoneNumber.replace(/\D/g, '');
      if (!dest.startsWith('+')) dest = '+' + dest;

      const payload = {
        assistantId,
        customer: { number: dest },
        phoneNumberId: req.body.phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID,
        metadata,
        maxDurationSeconds,
        firstMessage,
        voicemailMessage
      };

      const { data } = await axios.post(
        'https://api.vapi.ai/call/phone',
        payload,
        {
          headers: {
            Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      results.push({
        phoneNumber: dest,
        callId: data.id,
        status: data.status,
        success: true
      });

      // Deduct credits for successful call (unless super admin)
      if (userId && !(await isSuperAdmin(userId))) {
        try {
          const callInitiationCost = await getCreditCost('vapi_call', 'per_call');

          await CreditModel.deductCreditsFromUser(
            userId,
            callInitiationCost,
            'vapi_call',
            data.id,
            'Bulk outbound call initiation',
            {
              call_id: data.id,
              customer_number: dest,
              assistant_id: assistantId,
              endpoint: req.path,
              bulk_call: true
            }
          );

          // Create usage tracking record
          await UsageTrackingModel.createUsageRecord({
            user_id: userId,
            operation_type: 'vapi_call',
            operation_id: data.id,
            credits_consumed: callInitiationCost,
            unit_cost: callInitiationCost,
            units_consumed: 1,
            unit_type: 'calls',
            operation_details: {
              call_id: data.id,
              customer_number: dest,
              assistant_id: assistantId,
              endpoint: req.path,
              bulk_call: true
            },
            status: 'completed'
          });
        } catch (creditError) {
          console.error('Error deducting credits for bulk call:', creditError);
          // Don't fail the call if credit deduction fails, but log it
        }
      }
    } catch (error) {
      errors.push({
        phoneNumber,
        error: error.response?.data?.message || error.message,
        success: false
      });
    }
  }

  // Log total credits deducted for bulk calls
  if (userId && !(await isSuperAdmin(userId)) && results.length > 0) {
    const callInitiationCost = await getCreditCost('vapi_call', 'per_call');
    const totalCreditsDeducted = callInitiationCost * results.length;
    console.log(`💰 Total credits deducted: ${totalCreditsDeducted} credits for ${results.length} bulk calls`);
  }

  return res.status(201).json({
    success: true,
    message: `Bulk calls initiated: ${results.length} successful, ${errors.length} failed`,
    data: {
      successful: results,
      failed: errors,
      totalRequested: phoneNumbers.length,
      totalSuccessful: results.length,
      totalFailed: errors.length
    }
  });
};

// Schedule outbound call
const scheduleCall = async (req, res) => {
  const { assistantId, phoneNumber, scheduledAt, metadata, maxDurationSeconds, firstMessage, voicemailMessage } = req.body;

  if (!assistantId || !phoneNumber || !scheduledAt) {
    return res.status(400).json({
      success: false,
      message: 'assistantId, phoneNumber, and scheduledAt are required',
    });
  }

  // For demo purposes, we'll just return a scheduled call object
  // In production, you would store this in a database and use a job scheduler
  const scheduledCall = {
    id: `scheduled_${Date.now()}`,
    assistantId,
    phoneNumber,
    scheduledAt,
    status: "scheduled",
    metadata,
    maxDurationSeconds,
    firstMessage,
    voicemailMessage,
    createdAt: new Date().toISOString()
  };

  return res.status(201).json({
    success: true,
    message: "Call scheduled successfully",
    data: scheduledCall
  });
};

// Get call history for a specific contact by phone number
const getContactCallHistory = async (req, res) => {
  try {
    const { phoneNumber } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user?.id;

    if (!phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Phone number is required"
      });
    }

    // Normalize phone number to match database format
    let normalizedPhone = phoneNumber.replace(/\D/g, '');
    if (!normalizedPhone.startsWith('+')) {
      normalizedPhone = '+' + normalizedPhone;
    }

    // Try to get from local database first
    const CallModel = require('../../model/CallModel/CallModel');
    const callHistory = await CallModel.getCallHistoryByPhoneNumber(
      normalizedPhone,
      parseInt(page),
      parseInt(limit),
      userId
    );

    // Always try to fetch from VAPI to get the most up-to-date calls with recordings
    try {
      console.log(`🌐 Fetching calls from VAPI for phone number: ${normalizedPhone}`);
      const vapiResponse = await axios.get("https://api.vapi.ai/call", {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      // Filter calls by phone number
      const filteredCalls = vapiResponse.data.filter(call =>
        call.customer?.number === normalizedPhone ||
        call.customer?.number === phoneNumber
      );

      console.log(`📞 Found ${filteredCalls.length} VAPI calls for ${normalizedPhone}`);

      if (filteredCalls.length > 0) {
        // Add recording URLs and transcripts to the calls
        const callsWithRecordings = filteredCalls.map(call => {
          // Debug: Log the actual VAPI call structure
          console.log(`🔍 VAPI call ${call.id} fields:`, Object.keys(call));
          console.log(`🔍 VAPI call ${call.id} data:`, {
            id: call.id,
            status: call.status,
            startedAt: call.startedAt,
            endedAt: call.endedAt,
            createdAt: call.createdAt,
            updatedAt: call.updatedAt,
            duration: call.duration,
            cost: call.cost
          });

          // Calculate duration from startedAt and endedAt
          let calculatedDuration = 0;
          if (call.startedAt && call.endedAt) {
            const startTime = new Date(call.startedAt);
            const endTime = new Date(call.endedAt);
            calculatedDuration = Math.round((endTime - startTime) / 1000); // Duration in seconds
            console.log(`⏱️ Call ${call.id}: ${call.startedAt} -> ${call.endedAt} = ${calculatedDuration}s`);
          } else {
            console.log(`⚠️ Call ${call.id}: Missing timestamps - startedAt: ${call.startedAt}, endedAt: ${call.endedAt}`);
          }

          return {
            ...call,
            recordingUrl: call.status === "ended" && call.recordingUrl ? call.recordingUrl : null,
            recording: call.status === "ended" && call.recordingUrl ? "available" : null,
            // Map VAPI fields to our expected format
            call_id: call.id,
            customer_number: call.customer?.number,
            created_at: call.createdAt,
            updated_at: call.updatedAt,
            transcript: call.transcript || null,
            duration: calculatedDuration,
            cost: call.cost || 0,
            status: call.status,
            assistant_name: call.assistant?.name || 'Unknown Assistant'
          };
        });

        console.log(`✅ Returning ${callsWithRecordings.length} VAPI calls with recordings`);
        return res.status(200).json({
          success: true,
          message: "Call history retrieved successfully from VAPI",
          data: {
            calls: callsWithRecordings.slice(0, parseInt(limit)),
            totalCalls: filteredCalls.length,
            currentPage: parseInt(page),
            totalPages: Math.ceil(filteredCalls.length / parseInt(limit)),
            hasNextPage: parseInt(page) < Math.ceil(filteredCalls.length / parseInt(limit)),
            hasPrevPage: parseInt(page) > 1
          }
        });
      }
    } catch (vapiError) {
      console.error("❌ Error fetching from VAPI:", vapiError.response?.data || vapiError.message);
      // Continue with local results if VAPI fails
    }

    // If VAPI fails or returns no results, fall back to local database
    console.log(`📂 Falling back to local database calls: ${callHistory.calls.length} found`);
    if (callHistory.calls.length === 0) {
      console.log(`⚠️ No calls found in local database or VAPI for ${normalizedPhone}`);
    }

    return res.status(200).json({
      success: true,
      message: "Call history retrieved successfully",
      data: callHistory
    });

  } catch (error) {
    console.error("Error fetching contact call history:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch call history",
      error: error.message
    });
  }
};

// Sync recording for a specific call
const syncCallRecording = async (req, res) => {
  const { id } = req.params;

  try {
    const { syncCallRecording } = require('../utils/recordingSync');
    const result = await syncCallRecording(id);

    if (result.success) {
      return res.status(200).json({
        success: true,
        message: "Recording synced successfully",
        data: { recordingUrl: result.recordingUrl }
      });
    } else {
      return res.status(404).json({
        success: false,
        message: result.reason || "Recording not available"
      });
    }
  } catch (error) {
    console.error("Error syncing call recording:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync recording",
      error: error.message
    });
  }
};

// Sync all recordings from VAPI
const syncAllRecordings = async (req, res) => {
  try {
    const { syncRecordingsFromVAPI } = require('../utils/recordingSync');
    const result = await syncRecordingsFromVAPI();

    return res.status(200).json({
      success: true,
      message: "Recording sync completed",
      data: result
    });
  } catch (error) {
    console.error("Error syncing recordings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync recordings",
      error: error.message
    });
  }
};

// Simple VAPI-only endpoints for campaign calls
const getCampaignCallRecording = async (req, res) => {
  const { id } = req.params;
  console.log(`🎵 Getting campaign call recording directly from VAPI: ${id}`);

  try {
    const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const vapiCall = vapiResponse.data;
    console.log(`🌐 VAPI call data:`, vapiCall ? 'Found' : 'Not found');

    if (vapiCall && vapiCall.recordingUrl) {
      return res.status(200).json({
        success: true,
        message: "Campaign call recording retrieved successfully",
        data: {
          recordingUrl: vapiCall.recordingUrl,
          downloadUrl: vapiCall.recordingUrl,
          format: "mp3",
          duration: vapiCall.duration || 0,
          status: "available",
          call_id: id
        },
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Recording not available for this campaign call",
        data: null
      });
    }

  } catch (error) {
    console.error(`❌ Error fetching campaign call recording ${id}:`, error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaign call recording",
      error: error.response?.data || error.message,
    });
  }
};

const getCampaignCallTranscript = async (req, res) => {
  const { id } = req.params;
  console.log(`🔍 Getting campaign call transcript directly from VAPI: ${id}`);

  try {
    const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const vapiCall = vapiResponse.data;
    console.log(`🌐 VAPI call data:`, vapiCall ? 'Found' : 'Not found');

    if (vapiCall && (vapiCall.transcript || vapiCall.analysis?.summary)) {
      const transcript = vapiCall.transcript || vapiCall.analysis?.summary || '';

      return res.status(200).json({
        success: true,
        message: "Campaign call transcript retrieved successfully",
        data: {
          callId: id,
          transcript: transcript,
          confidence: 0.95,
          language: "en-US",
          duration: vapiCall.duration || 0,
          wordCount: transcript.split(' ').length,
          generatedAt: vapiCall.updatedAt || new Date().toISOString()
        },
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Transcript not available for this campaign call",
        data: null
      });
    }

  } catch (error) {
    console.error(`❌ Error fetching campaign call transcript ${id}:`, error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch campaign call transcript",
      error: error.response?.data || error.message,
    });
  }
};

// Proxy endpoint to serve VAPI recordings without CORS issues
const proxyRecording = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🎵 Proxying recording for call ID: ${id}`);

    // First try to get from VAPI directly
    try {
      console.log(`🌐 Fetching call data from VAPI for ID: ${id}`);
      const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const vapiCall = vapiResponse.data;
      console.log(`📞 VAPI call data:`, {
        id: vapiCall.id,
        status: vapiCall.status,
        hasRecording: !!vapiCall.recordingUrl,
        recordingUrl: vapiCall.recordingUrl ? 'Present' : 'Missing'
      });

      if (!vapiCall.recordingUrl) {
        console.log(`❌ No recording URL found in VAPI response for call ${id}`);
        return res.status(404).json({
          success: false,
          message: "Recording not found in VAPI"
        });
      }

      console.log(`🎵 Proxying recording from VAPI URL: ${vapiCall.recordingUrl.substring(0, 50)}...`);

      // Proxy the recording from VAPI
      const recordingResponse = await axios.get(vapiCall.recordingUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'AI-Cruitment-Proxy/1.0'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log(`✅ Recording response headers:`, {
        contentType: recordingResponse.headers['content-type'],
        contentLength: recordingResponse.headers['content-length'],
        status: recordingResponse.status
      });

      // Set appropriate headers
      res.setHeader('Content-Type', recordingResponse.headers['content-type'] || 'audio/mpeg');
      if (recordingResponse.headers['content-length']) {
        res.setHeader('Content-Length', recordingResponse.headers['content-length']);
      }
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Cache-Control', 'public, max-age=3600');

      // Pipe the recording stream
      recordingResponse.data.pipe(res);

      recordingResponse.data.on('end', () => {
        console.log(`✅ Recording proxy completed for call ${id}`);
      });

      recordingResponse.data.on('error', (streamError) => {
        console.error(`❌ Recording stream error for call ${id}:`, streamError);
      });

    } catch (vapiError) {
      console.error(`❌ Error fetching recording from VAPI for call ${id}:`, {
        message: vapiError.message,
        status: vapiError.response?.status,
        statusText: vapiError.response?.statusText
      });

      // Try fallback to database
      try {
        const CallModel = require('../model/CallModel/CallModel');
        const call = await CallModel.getCallById(id);

        if (call && call.recording_url) {
          console.log(`🔄 Trying fallback from database: ${call.recording_url.substring(0, 50)}...`);

          const recordingResponse = await axios.get(call.recording_url, {
            responseType: 'stream',
            headers: {
              'User-Agent': 'AI-Cruitment-Proxy/1.0'
            }
          });

          // Set appropriate headers
          res.setHeader('Content-Type', recordingResponse.headers['content-type'] || 'audio/mpeg');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Cache-Control', 'public, max-age=3600');

          // Pipe the recording stream
          recordingResponse.data.pipe(res);
          return;
        }
      } catch (dbError) {
        console.error(`❌ Database fallback failed:`, dbError.message);
      }

      return res.status(404).json({
        success: false,
        message: "Recording not available",
        details: vapiError.response?.status === 404 ? "Call not found in VAPI" : "VAPI error"
      });
    }

  } catch (error) {
    console.error(`❌ Error in proxy recording for call ${id}:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to proxy recording",
      error: error.message
    });
  }
};

module.exports = {
  createCall,
  getAllCalls,
  getCallsbyID,
  getCallRecording,
  endCall,
  getCallTranscript,
  getCallStats,
  createBulkCalls,
  scheduleCall,
  getContactCallHistory,
  syncCallRecording,
  syncAllRecordings,
  getCampaignCallRecording,
  getCampaignCallTranscript,
  proxyRecording
};
