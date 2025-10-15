const axios = require("axios");
require("dotenv").config();


const createCall = async (req, res) => {
  const { id: assistantId, phoneNumber, phoneNumberId } = req.body;
  if (!assistantId || !phoneNumber) {
    return res.status(400).json({
      success: false,
      message: 'assistantId and phoneNumber (+E.164) are required',
    });
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
    return res.status(201).json({
      success: true,
      callId:  data.id,
      status:  data.status,
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
  try {
    // First, check if we have the recording URL in our database
    const CallModel = require('../../model/CallModel/CallModel');
    const call = await CallModel.getCallById(id);

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
    try {
      const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const vapiCall = vapiResponse.data;

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
    console.log(`🛑 Ending call ${id}`, { controlUrl });

    // If control URL is provided, try to use it first (more reliable for active calls)
    if (controlUrl) {
      try {
        console.log('📞 Using VAPI control URL to end call...');
        const controlResponse = await axios.post(controlUrl, {
          type: 'end-call'
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000 // 10 second timeout
        });

        console.log('✅ Call ended via control URL successfully');
        return res.status(200).json({
          success: true,
          message: "Call ended successfully via control",
          data: controlResponse.data,
        });
      } catch (controlError) {
        console.warn('⚠️ Control URL method failed, falling back to VAPI API:', controlError.message);
        // Fall through to VAPI API method
      }
    }

    // Fallback to VAPI REST API method
    console.log('📞 Using VAPI REST API to end call...');
    // Use the correct VAPI endpoint: POST /call/{id}/end (not PATCH with status)
    const vapiResponse = await axios.post(`https://api.vapi.ai/call/${id}/end`,
      {}, // Empty body for end call
      {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log('✅ Call ended via VAPI API successfully');
    return res.status(200).json({
      success: true,
      message: "Call ended successfully",
      data: vapiResponse.data,
    });
  } catch (error) {
    console.error("❌ Error ending call:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.message || "Failed to end call";
    return res.status(status).json({
      success: false,
      message,
      error: error.response?.data || error.message,
    });
  }
};

// Get call transcript
const getCallTranscript = async (req, res) => {
  const { id } = req.params;
  try {
    // First, check if we have the transcript in our database
    const CallModel = require('../../model/CallModel/CallModel');
    const call = await CallModel.getCallById(id);

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
    try {
      const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const vapiCall = vapiResponse.data;

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
      console.error("Error fetching from VAPI:", vapiError.response?.data || vapiError.message);
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

  if (!assistantId || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'assistantId and phoneNumbers array are required',
    });
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
        phoneNumberId: phoneNumberId || process.env.VAPI_PHONE_NUMBER_ID,
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
    } catch (error) {
      errors.push({
        phoneNumber,
        error: error.response?.data?.message || error.message,
        success: false
      });
    }
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

    // If no local calls found, try to fetch from VAPI
    if (callHistory.calls.length === 0) {
      try {
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

        // Add recording URLs and transcripts to the calls
        const callsWithRecordings = filteredCalls.map(call => ({
          ...call,
          recordingUrl: call.status === "ended" && call.recordingUrl ? call.recordingUrl : null,
          recording: call.status === "ended" && call.recordingUrl ? "available" : null,
          // Map VAPI fields to our expected format
          call_id: call.id,
          customer_number: call.customer?.number,
          created_at: call.createdAt,
          updated_at: call.updatedAt,
          transcript: call.transcript || null,
          duration: call.duration || 0,
          cost: call.cost || 0,
          status: call.status,
          assistant_name: call.assistant?.name || 'Unknown Assistant'
        }));

        return res.status(200).json({
          success: true,
          message: "Call history retrieved successfully",
          data: {
            calls: callsWithRecordings.slice(0, parseInt(limit)),
            totalCalls: filteredCalls.length,
            currentPage: parseInt(page),
            totalPages: Math.ceil(filteredCalls.length / parseInt(limit)),
            hasNextPage: parseInt(page) < Math.ceil(filteredCalls.length / parseInt(limit)),
            hasPrevPage: parseInt(page) > 1
          }
        });
      } catch (vapiError) {
        console.error("Error fetching from VAPI:", vapiError.response?.data || vapiError.message);
        // Continue with empty local results if VAPI fails
      }
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
    const { syncCallRecording } = require('../../utils/recordingSync');
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
    const { syncRecordingsFromVAPI } = require('../../utils/recordingSync');
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

// Proxy endpoint to serve VAPI recordings without CORS issues
const proxyRecording = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🎵 [Middleware] Proxying recording for call ID: ${id}`);

    // First try to get from VAPI directly
    try {
      console.log(`🌐 [Middleware] Fetching call data from VAPI for ID: ${id}`);
      const vapiResponse = await axios.get(`https://api.vapi.ai/call/${id}`, {
        headers: {
          Authorization: `Bearer ${process.env.VAPI_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      });

      const vapiCall = vapiResponse.data;
      console.log(`📞 [Middleware] VAPI call data:`, {
        id: vapiCall.id,
        status: vapiCall.status,
        hasRecording: !!vapiCall.recordingUrl,
        recordingUrl: vapiCall.recordingUrl ? 'Present' : 'Missing'
      });

      if (!vapiCall.recordingUrl) {
        console.log(`❌ [Middleware] No recording URL found in VAPI response for call ${id}`);
        return res.status(404).json({
          success: false,
          message: "Recording not found in VAPI"
        });
      }

      console.log(`🎵 [Middleware] Proxying recording from VAPI URL: ${vapiCall.recordingUrl.substring(0, 50)}...`);

      // Proxy the recording from VAPI
      const recordingResponse = await axios.get(vapiCall.recordingUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'AI-Cruitment-Proxy/1.0'
        },
        timeout: 30000 // 30 second timeout
      });

      console.log(`✅ [Middleware] Recording response headers:`, {
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
        console.log(`✅ [Middleware] Recording proxy completed for call ${id}`);
      });

      recordingResponse.data.on('error', (streamError) => {
        console.error(`❌ [Middleware] Recording stream error for call ${id}:`, streamError);
      });

    } catch (vapiError) {
      console.error(`❌ [Middleware] Error fetching recording from VAPI for call ${id}:`, {
        message: vapiError.message,
        status: vapiError.response?.status,
        statusText: vapiError.response?.statusText
      });

      return res.status(404).json({
        success: false,
        message: "Recording not available",
        details: vapiError.response?.status === 404 ? "Call not found in VAPI" : "VAPI error"
      });
    }

  } catch (error) {
    console.error(`❌ [Middleware] Error in proxy recording for call ${id}:`, error);
    res.status(500).json({
      success: false,
      message: "Failed to proxy recording",
      error: error.message
    });
  }
};

// Campaign call recording (placeholder)
const getCampaignCallRecording = async (req, res) => {
  // This would be similar to getCallRecording but for campaign calls
  return getCallRecording(req, res);
};

// Campaign call transcript (placeholder)
const getCampaignCallTranscript = async (req, res) => {
  // This would be similar to getCallTranscript but for campaign calls
  return getCallTranscript(req, res);
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
