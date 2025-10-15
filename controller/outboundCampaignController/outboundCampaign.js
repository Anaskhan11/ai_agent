const axios = require("axios");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

console.log("Outbound Campaign Controller - VAPI Configuration:");
console.log("VAPI_BASE_URL:", VAPI_BASE_URL);
console.log("VAPI_SECRET_KEY loaded:", VAPI_SECRET_KEY ? "✓" : "✗");
console.log("VAPI_SECRET_KEY length:", VAPI_SECRET_KEY ? VAPI_SECRET_KEY.length : 0);

// Configure multer for CSV file uploads
const upload = multer({ dest: 'uploads/' });

// Get all campaigns with user isolation
const getAllCampaigns = async (req, res) => {
  try {
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    console.log("Fetching campaigns with user isolation...");
    console.log("User ID:", currentUserId, "Super Admin:", isSuperAdmin);

    let campaigns = [];

    try {
      // Get campaigns from VAPI with better error handling
      const response = await axios.get(`${VAPI_BASE_URL}/campaign`, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        timeout: 10000, // 10 second timeout
        validateStatus: function (status) {
          return status < 500; // Accept any status code less than 500
        }
      });

      console.log("VAPI Response Status:", response.status);
      console.log("VAPI Response Headers:", response.headers);
      console.log("VAPI Response Data Type:", typeof response.data);
      console.log("VAPI Response Data:", response.data);

      // Handle different response formats
      if (response.status === 200 && response.data) {
        if (typeof response.data === 'string') {
          try {
            const parsedData = JSON.parse(response.data);
            campaigns = parsedData.results || parsedData || [];
          } catch (parseError) {
            console.error("Failed to parse VAPI response as JSON:", parseError.message);
            campaigns = [];
          }
        } else if (Array.isArray(response.data)) {
          campaigns = response.data;
        } else if (response.data.results) {
          campaigns = response.data.results;
        } else if (response.data.data) {
          campaigns = response.data.data;
        } else {
          campaigns = [];
        }
      } else {
        console.warn("VAPI returned non-200 status or empty data:", response.status);
        campaigns = [];
      }

    } catch (vapiError) {
      console.error("VAPI API Error:", {
        message: vapiError.message,
        code: vapiError.code,
        status: vapiError.response?.status,
        statusText: vapiError.response?.statusText,
        data: vapiError.response?.data
      });

      // If VAPI is down or returns an error, return empty campaigns instead of failing
      campaigns = [];
    }

    // If not super admin, filter campaigns by user_id from local database
    if (!isSuperAdmin && campaigns.length > 0) {
      try {
        const CampaignModel = require("../../model/CampaignModel/CampaignModel");
        const userCampaigns = await CampaignModel.getCampaignsByUserId(currentUserId);
        const userCampaignIds = userCampaigns.map(c => c.campaign_id);

        // Filter VAPI campaigns to only include user's campaigns
        campaigns = campaigns.filter(c => userCampaignIds.includes(c.id));
      } catch (dbError) {
        console.error("Database error while filtering campaigns:", dbError.message);
        // Continue with unfiltered campaigns rather than failing
      }
    }

    console.log("Campaigns fetched successfully:", campaigns.length, "campaigns for user");

    res.status(200).json({
      success: true,
      message: "Campaigns retrieved successfully",
      data: campaigns
    });
  } catch (error) {
    console.error("Error fetching campaigns:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch campaigns",
      error: error.message
    });
  }
};

// Get campaign by ID with user isolation
const getCampaignById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    const CampaignModel = require("../../model/CampaignModel/CampaignModel");

    // Check if user has access to this campaign
    if (!isSuperAdmin) {
      const hasAccess = await CampaignModel.campaignExistsForUser(id, currentUserId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own campaigns."
        });
      }
    }

    const response = await axios.get(`${VAPI_BASE_URL}/campaign/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Campaign retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching campaign:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch campaign",
      error: error.response?.data || error.message
    });
  }
};

// Create campaign with local DB storage
const createCampaign = async (req, res) => {
  try {
    const currentUserId = req.user?.user?.id || req.user?.id;

    // Check if user is authenticated
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in to create campaigns."
      });
    }
    const {
      name,
      phoneNumberId,
      customers,
      assistantId,
      workflowId,
      schedulePlan,
      autoLaunch
    } = req.body;

    console.log("Creating campaign with data:", {
      name,
      phoneNumberId,
      customersCount: customers?.length,
      assistantId,
      workflowId,
      schedulePlan,
      autoLaunch
    });

    // Validate required fields
    if (!name || !phoneNumberId || !customers || customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number ID, and customers are required"
      });
    }

    // Ensure either assistantId or workflowId is provided
    if (!assistantId && !workflowId) {
      return res.status(400).json({
        success: false,
        message: "Either assistantId or workflowId is required"
      });
    }

    // Validate phone numbers are in E.164 format
    const invalidNumbers = customers.filter(customer => {
      const number = customer.number;
      return !number || !number.startsWith('+') || !/^\+[1-9]\d{1,14}$/.test(number);
    });

    if (invalidNumbers.length > 0) {
      console.error("Invalid phone numbers found:", invalidNumbers);
      return res.status(400).json({
        success: false,
        message: `Invalid phone numbers found. Please ensure all numbers are in E.164 format. Found ${invalidNumbers.length} invalid numbers.`,
        invalidNumbers: invalidNumbers.map(c => c.number)
      });
    }

    const campaignData = {
      name,
      phoneNumberId,
      customers,
      ...(assistantId && { assistantId }),
      ...(workflowId && { workflowId }),
      ...(schedulePlan && { schedulePlan })
    };

    console.log("Sending campaign data to VAPI:", JSON.stringify(campaignData, null, 2));

    const response = await axios.post(`${VAPI_BASE_URL}/campaign`, campaignData, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("VAPI campaign creation response:", response.data);

    const vapiCampaign = response.data;

    // Store in local database with user association
    const CampaignModel = require("../../model/CampaignModel/CampaignModel");
    await CampaignModel.createCampaign({
      user_id: currentUserId,
      campaign_id: vapiCampaign.id || null,
      org_id: vapiCampaign.orgId || null,
      name: vapiCampaign.name || name,
      description: vapiCampaign.description || null,
      type: 'outbound_calls',
      assistant_id: assistantId || null,
      squad_id: vapiCampaign.squadId || null,
      workflow_id: workflowId || null,
      phone_number_id: phoneNumberId || null,
      contact_list_ids: [],
      schedule_config: schedulePlan || {},
      targeting_rules: {},
      call_settings: {},
      status: vapiCampaign.status || 'draft',
      total_contacts: customers?.length || 0,
      metadata: {
        customers: customers || [],
        autoLaunch: autoLaunch || false
      }
    });

    // Check if autoLaunch is enabled and provide appropriate message
    if (autoLaunch) {
      // VAPI campaigns are automatically launched when created
      // Check the campaign status to confirm it's running
      try {
        console.log("Checking campaign status for auto-launch:", response.data.id);

        // Wait a moment for the campaign to be fully processed
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the campaign status to verify it's running
        const statusResponse = await axios.get(`${VAPI_BASE_URL}/campaign/${response.data.id}`, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });

        console.log("Campaign status after creation:", statusResponse.data.status);
        console.log("Campaign call counters:", {
          scheduled: statusResponse.data.callsCounterScheduled,
          queued: statusResponse.data.callsCounterQueued,
          inProgress: statusResponse.data.callsCounterInProgress,
          ended: statusResponse.data.callsCounterEnded,
          voicemail: statusResponse.data.callsCounterEndedVoicemail
        });

        // If campaign is scheduled, try to launch it
        if (statusResponse.data.status === "scheduled") {
          try {
            console.log("Attempting to launch scheduled campaign...");
            const launchResponse = await axios.patch(`${VAPI_BASE_URL}/campaign/${response.data.id}`, {
              status: "in-progress"
            }, {
              headers: {
                Authorization: `Bearer ${VAPI_SECRET_KEY}`,
                "Content-Type": "application/json"
              }
            });

            console.log("Auto-launch successful:", launchResponse.data.status);
            res.status(201).json({
              success: true,
              message: "Campaign created and launched successfully",
              data: launchResponse.data
            });
          } catch (launchError) {
            console.error("Auto-launch failed:", launchError.response?.data || launchError.message);
            res.status(201).json({
              success: true,
              message: "Campaign created successfully but auto-launch failed",
              data: statusResponse.data,
              launchError: launchError.response?.data?.message || launchError.message
            });
          }
        } else if (statusResponse.data.status === "in-progress") {
          // Check if calls are actually being made
          console.log("Campaign is in-progress. Checking call details...");

          // Wait a bit more and check call status
          setTimeout(async () => {
            try {
              const callCheckResponse = await axios.get(`${VAPI_BASE_URL}/campaign/${response.data.id}`, {
                headers: {
                  Authorization: `Bearer ${VAPI_SECRET_KEY}`,
                  "Content-Type": "application/json"
                }
              });

              console.log("Call status check:", {
                scheduled: callCheckResponse.data.callsCounterScheduled,
                queued: callCheckResponse.data.callsCounterQueued,
                inProgress: callCheckResponse.data.callsCounterInProgress,
                ended: callCheckResponse.data.callsCounterEnded
              });

              if (callCheckResponse.data.calls) {
                console.log("Individual calls:", Object.keys(callCheckResponse.data.calls).length);
                Object.entries(callCheckResponse.data.calls).forEach(([callId, call]) => {
                  console.log(`Call ${callId}:`, {
                    status: call.status,
                    customer: call.customer?.number,
                    startedAt: call.startedAt,
                    endedAt: call.endedAt
                  });
                });
              }
            } catch (error) {
              console.error("Error checking call status:", error.response?.data || error.message);
            }
          }, 5000); // Check after 5 seconds

          res.status(201).json({
            success: true,
            message: "Campaign created and launched successfully",
            data: statusResponse.data
          });
        } else {
          res.status(201).json({
            success: true,
            message: "Campaign created successfully",
            data: statusResponse.data
          });
        }
      } catch (statusError) {
        console.error("Failed to check campaign status:", statusError.response?.data || statusError.message);

        // Return the original campaign data even if status check failed
        res.status(201).json({
          success: true,
          message: "Campaign created successfully",
          data: response.data
        });
      }
    } else {
      res.status(201).json({
        success: true,
        message: "Campaign created successfully",
        data: response.data
      });
    }
  } catch (error) {
    console.error("Error creating campaign:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        headers: error.config?.headers
      }
    });
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to create campaign",
      error: error.response?.data || error.message
    });
  }
};

// Update campaign
const updateCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const response = await axios.patch(`${VAPI_BASE_URL}/campaign/${id}`, updateData, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Campaign updated successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error updating campaign:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to update campaign",
      error: error.response?.data || error.message
    });
  }
};

// Delete campaign
const deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    await axios.delete(`${VAPI_BASE_URL}/campaign/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Campaign deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting campaign:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete campaign",
      error: error.response?.data || error.message
    });
  }
};

// Get campaign calls
const getCampaignCalls = async (req, res) => {
  try {
    const { id } = req.params;

    // Get campaign details first to access calls
    const campaignResponse = await axios.get(`${VAPI_BASE_URL}/campaign/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const campaign = campaignResponse.data;
    const rawCalls = campaign.calls || {};

    console.log('📞 Campaign calls data structure:');
    console.log('Campaign ID:', campaign.id);
    console.log('Campaign status:', campaign.status);
    console.log('Raw calls object keys:', Object.keys(rawCalls));

    // Parse the JSON strings in the calls object
    const parsedCalls = {};
    for (const [callId, callDataString] of Object.entries(rawCalls)) {
      try {
        // The call data is stored as a JSON string, we need to parse it
        const parsedCall = typeof callDataString === 'string'
          ? JSON.parse(callDataString)
          : callDataString;

        // Calculate duration if not provided
        if (!parsedCall.duration && parsedCall.startedAt && parsedCall.endedAt) {
          const start = new Date(parsedCall.startedAt).getTime();
          const end = new Date(parsedCall.endedAt).getTime();
          parsedCall.duration = Math.round((end - start) / 1000); // duration in seconds
        }

        parsedCalls[callId] = parsedCall;
        console.log(`✅ Parsed call ${callId}:`, {
          id: parsedCall.id,
          customer: parsedCall.customer?.name,
          status: parsedCall.status,
          duration: parsedCall.duration
        });
      } catch (error) {
        console.error(`❌ Error parsing call ${callId}:`, error.message);
        // Keep the original data if parsing fails
        parsedCalls[callId] = callDataString;
      }
    }

    res.status(200).json({
      success: true,
      message: "Campaign calls retrieved successfully",
      data: parsedCalls
    });
  } catch (error) {
    console.error("Error fetching campaign calls:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch campaign calls",
      error: error.response?.data || error.message
    });
  }
};

// Launch campaign (if it's scheduled)
const launchCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Attempting to launch campaign with ID: ${id}`);

    // First, get the campaign to check its current status
    const campaignResponse = await axios.get(`${VAPI_BASE_URL}/campaign/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const campaign = campaignResponse.data;
    console.log(`Campaign current status: ${campaign.status}`);
    console.log(`Campaign customers count: ${campaign.customers?.length || 0}`);

    // If campaign is already in progress, return success
    if (campaign.status === "in-progress") {
      console.log("Campaign is already running");
      return res.status(200).json({
        success: true,
        message: "Campaign is already running",
        data: campaign,
        currentStatus: campaign.status,
        campaignId: id
      });
    }

    // If campaign has ended, return error
    if (campaign.status === "ended") {
      return res.status(400).json({
        success: false,
        message: "Campaign cannot be launched. Campaign has already ended.",
        currentStatus: campaign.status,
        campaignId: id
      });
    }

    // If campaign is scheduled, try to launch it by setting status to in-progress
    if (campaign.status === "scheduled") {
      console.log("Campaign is scheduled. Attempting to launch by setting status to in-progress.");

      try {
        // Try to launch the campaign by updating its status
        const launchResponse = await axios.patch(`${VAPI_BASE_URL}/campaign/${id}`, {
          status: "in-progress"
        }, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });

        console.log("Campaign launch response:", launchResponse.data);

        return res.status(200).json({
          success: true,
          message: "Campaign launched successfully",
          data: launchResponse.data
        });
      } catch (launchError) {
        console.error("Failed to launch campaign by setting status:", launchError.response?.data || launchError.message);

        // If we can't launch it, wait and check if it starts automatically
        console.log("Waiting to see if campaign starts automatically...");
        await new Promise(resolve => setTimeout(resolve, 2000));

        const updatedCampaignResponse = await axios.get(`${VAPI_BASE_URL}/campaign/${id}`, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });

        const updatedCampaign = updatedCampaignResponse.data;
        console.log(`Updated campaign status: ${updatedCampaign.status}`);

        if (updatedCampaign.status === "in-progress") {
          return res.status(200).json({
            success: true,
            message: "Campaign launched successfully",
            data: updatedCampaign
          });
        } else {
          return res.status(400).json({
            success: false,
            message: "Failed to launch campaign. Campaign remains scheduled.",
            data: updatedCampaign,
            error: launchError.response?.data || launchError.message
          });
        }
      }
    }

    // For any other status, return current state
    return res.status(200).json({
      success: true,
      message: `Campaign status is ${campaign.status}`,
      data: campaign,
      currentStatus: campaign.status,
      campaignId: id
    });

  } catch (error) {
    console.error("Error launching campaign:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
      campaignId: req.params.id,
      url: error.config?.url,
      method: error.config?.method,
      headers: error.config?.headers
    });

    const status = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message;
    const errorDetails = error.response?.data;

    // Provide more specific error messages based on status code
    let userMessage = "Failed to launch campaign";
    if (status === 400) {
      userMessage = "Campaign cannot be launched. Please check campaign status and try again.";
    } else if (status === 401) {
      userMessage = "Authentication failed. Please check API credentials.";
    } else if (status === 404) {
      userMessage = "Campaign not found. Please verify the campaign ID.";
    }

    res.status(status).json({
      success: false,
      message: userMessage,
      error: errorMessage,
      details: errorDetails,
      campaignId: req.params.id
    });
  }
};

// Pause campaign
const pauseCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    // Based on VAPI API, we can only set status to "ended"
    // So "pause" actually means ending the campaign
    const response = await axios.patch(`${VAPI_BASE_URL}/campaign/${id}`, {
      status: "ended"
    }, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Campaign ended successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error pausing campaign:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to pause campaign",
      error: error.response?.data || error.message
    });
  }
};

// Resume campaign - VAPI doesn't support resuming ended campaigns
// Once a campaign is ended, it cannot be resumed
const resumeCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    // Get campaign status first
    const campaignResponse = await axios.get(`${VAPI_BASE_URL}/campaign/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const campaign = campaignResponse.data;

    if (campaign.status === "ended") {
      return res.status(400).json({
        success: false,
        message: "Cannot resume an ended campaign. Please create a new campaign instead.",
        currentStatus: campaign.status
      });
    }

    if (campaign.status === "in-progress") {
      return res.status(200).json({
        success: true,
        message: "Campaign is already running",
        data: campaign
      });
    }

    // If scheduled, try to launch it
    if (campaign.status === "scheduled") {
      const response = await axios.patch(`${VAPI_BASE_URL}/campaign/${id}`, {
        status: "in-progress"
      }, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      });

      res.status(200).json({
        success: true,
        message: "Campaign resumed successfully",
        data: response.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Cannot resume campaign with status: ${campaign.status}`,
        currentStatus: campaign.status
      });
    }
  } catch (error) {
    console.error("Error resuming campaign:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to resume campaign",
      error: error.response?.data || error.message
    });
  }
};

// Cancel campaign
const cancelCampaign = async (req, res) => {
  try {
    const { id } = req.params;

    // Based on VAPI API, we can only set status to "ended"
    // The endedReason property is not allowed in the update
    const response = await axios.patch(`${VAPI_BASE_URL}/campaign/${id}`, {
      status: "ended"
    }, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Campaign cancelled successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error cancelling campaign:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to cancel campaign",
      error: error.response?.data || error.message
    });
  }
};

// Test VAPI connection and campaign status
const testVapiConnection = async (req, res) => {
  try {
    console.log("Testing VAPI connection...");

    // Test basic connection
    const testResponse = await axios.get(`${VAPI_BASE_URL}/assistant?limit=1`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log("VAPI connection test successful");

    // If campaign ID is provided, test campaign access
    const { campaignId } = req.query;
    let campaignInfo = null;

    if (campaignId) {
      try {
        const campaignResponse = await axios.get(`${VAPI_BASE_URL}/campaign/${campaignId}`, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });
        campaignInfo = campaignResponse.data;
        console.log("Campaign info:", campaignInfo);
      } catch (campaignError) {
        console.error("Campaign access error:", campaignError.response?.data);
        campaignInfo = { error: campaignError.response?.data || campaignError.message };
      }
    }

    res.status(200).json({
      success: true,
      message: "VAPI connection test successful",
      data: {
        connection: "OK",
        apiKey: VAPI_SECRET_KEY ? `${VAPI_SECRET_KEY.substring(0, 8)}...` : "Missing",
        baseUrl: VAPI_BASE_URL,
        campaign: campaignInfo
      }
    });
  } catch (error) {
    console.error("VAPI connection test failed:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "VAPI connection test failed",
      error: error.response?.data || error.message
    });
  }
};

module.exports = {
  getAllCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  getCampaignCalls,
  launchCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  testVapiConnection
};
