const axios = require("axios");
const VapiService = require("../../services/VapiService");
require("dotenv").config({ path: "./config/config.env" });

const VAPI_BASE_URL = "https://api.vapi.ai";
// Use the same key as AssistantController for consistency
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY || "aa6161d2-7ba0-4182-96aa-fee4a9f14fd8";

console.log("VAPI_SECRET_KEY loaded:", VAPI_SECRET_KEY ? "✓" : "✗");
console.log("Environment VAPI_SECRET_KEY:", process.env.VAPI_SECRET_KEY ? "✓" : "✗");

// Helper function to validate URLs
const isValidUrl = (string) => {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
};

// Helper function to sanitize phone number
const sanitizePhoneNumber = (phoneNumber) => {
  // Remove all non-digit characters except +
  let cleaned = phoneNumber.replace(/[^\d+]/g, '');

  // Ensure it starts with +
  if (!cleaned.startsWith('+')) {
    // If it starts with 1 and is 11 digits, add +
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      cleaned = '+' + cleaned;
    } else if (cleaned.length === 10) {
      // Assume US number if 10 digits
      cleaned = '+1' + cleaned;
    } else {
      // Return as is, validation will catch invalid format
      cleaned = '+' + cleaned;
    }
  }

  return cleaned;
};

// List all phone numbers with user isolation and user information
const listPhoneNumbers = async (req, res) => {
  try {
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    console.log("Fetching phone numbers with user isolation...");
    console.log("User ID:", currentUserId, "Super Admin:", isSuperAdmin);

    // Get phone numbers from VAPI
    const response = await axios.get(`${VAPI_BASE_URL}/phone-number`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    let phoneNumbers = response.data || [];
    const PhoneNumberModel = require("../../model/PhoneNumberModel/PhoneNumberModel");

    // Get phone numbers with user information from local database
    let localPhoneNumbers;
    if (isSuperAdmin) {
      // Super admin sees all phone numbers with user info
      localPhoneNumbers = await PhoneNumberModel.getAllPhoneNumbersWithUsers();
    } else {
      // Regular users see only their phone numbers
      localPhoneNumbers = await PhoneNumberModel.getPhoneNumbersByUserId(currentUserId);
      const userPhoneNumberIds = localPhoneNumbers.map(pn => pn.phone_number_id);

      // Filter VAPI phone numbers to only include user's phone numbers
      phoneNumbers = phoneNumbers.filter(pn => userPhoneNumberIds.includes(pn.id));
    }

    // Create a map of local phone number data by phone_number_id for quick lookup
    const localPhoneNumberMap = new Map();
    localPhoneNumbers.forEach(localPn => {
      if (localPn.phone_number_id) {
        localPhoneNumberMap.set(localPn.phone_number_id, localPn);
      }
    });

    // Merge VAPI data with local user information
    const enrichedPhoneNumbers = phoneNumbers.map(vapiPn => {
      const localData = localPhoneNumberMap.get(vapiPn.id);
      return {
        ...vapiPn,
        // Add user information from local database
        user_id: localData?.user_id || null,
        user_name: localData?.user_name || null,
        user_email: localData?.user_email || null,
        created_by: localData?.user_name || 'Unknown User',
        local_created_at: localData?.created_at || null
      };
    });

    console.log("Phone numbers fetched successfully:", enrichedPhoneNumbers.length, "numbers for user");

    res.status(200).json({
      success: true,
      message: "Phone numbers retrieved successfully",
      data: enrichedPhoneNumbers
    });
  } catch (error) {
    console.error("Error fetching phone numbers:");
    console.error("Status:", error.response?.status);
    console.error("Status Text:", error.response?.statusText);
    console.error("Error Data:", error.response?.data);
    console.error("Error Message:", error.message);

    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch phone numbers",
      error: error.response?.data || error.message
    });
  }
};

// Get phone number by ID with user isolation
const getPhoneNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    const PhoneNumberModel = require("../../model/PhoneNumberModel/PhoneNumberModel");

    // Check if user has access to this phone number
    if (!isSuperAdmin) {
      const hasAccess = await PhoneNumberModel.phoneNumberExistsForUser(id, currentUserId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only view your own phone numbers."
        });
      }
    }

    const response = await axios.get(`${VAPI_BASE_URL}/phone-number/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Phone number retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching phone number:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch phone number",
      error: error.response?.data || error.message
    });
  }
};

// Create phone number with local DB storage
const createPhoneNumber = async (req, res) => {
  try {
    const currentUserId = req.user?.user?.id || req.user?.id;

    // Check if user is authenticated
    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please log in to create phone numbers."
      });
    }
    const {
      provider,
      phoneNumber,
      name,
      assistantId,
      squadId,
      workflowId,
      fallbackDestination,
      serverUrl,
      serverUrlSecret,
      // Provider-specific credentials
      twilioAccountSid,
      twilioAuthToken,
      vonageApiKey,
      vonageApiSecret,
      telnyxApiKey,
      telnyxApiSecret
    } = req.body;

    // Validate required fields
    if (!provider || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: "Provider and phone number are required"
      });
    }

    // Sanitize and validate phone number
    const sanitizedPhoneNumber = sanitizePhoneNumber(phoneNumber);
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(sanitizedPhoneNumber)) {
      return res.status(400).json({
        success: false,
        message: "Phone number must be in E.164 format (e.g., +1234567890)"
      });
    }

    // Validate provider
    const supportedProviders = ['twilio', 'vonage', 'telnyx', 'vapi'];
    if (!supportedProviders.includes(provider.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `Unsupported provider. Supported providers: ${supportedProviders.join(', ')}`
      });
    }

    // Validate URLs if provided
    if (serverUrl && !isValidUrl(serverUrl)) {
      return res.status(400).json({
        success: false,
        message: "Server URL must be a valid URL"
      });
    }

    // Validate JSON if fallbackDestination is provided
    if (fallbackDestination) {
      try {
        JSON.parse(fallbackDestination);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: "Fallback destination must be valid JSON"
        });
      }
    }

    // Validate provider-specific credentials
    let credentialData = {};
    switch (provider.toLowerCase()) {
      case 'twilio':
        if (!twilioAccountSid || !twilioAuthToken) {
          return res.status(400).json({
            success: false,
            message: "Twilio account SID and auth token are required"
          });
        }
        credentialData = {
          provider: 'twilio',
          accountSid: twilioAccountSid,
          authToken: twilioAuthToken
        };
        break;

      case 'vonage':
        if (!vonageApiKey || !vonageApiSecret) {
          return res.status(400).json({
            success: false,
            message: "Vonage API key and secret are required"
          });
        }
        credentialData = {
          provider: 'vonage',
          name: `Vonage Credential - ${phoneNumber}`,
          apiKey: vonageApiKey,
          apiSecret: vonageApiSecret
        };
        break;

      case 'telnyx':
        if (!telnyxApiKey) {
          return res.status(400).json({
            success: false,
            message: "Telnyx API key is required"
          });
        }
        credentialData = {
          provider: 'telnyx',
          name: `Telnyx Credential - ${phoneNumber}`,
          apiKey: telnyxApiKey,
          apiSecret: telnyxApiSecret
        };
        break;

      case 'vapi':
        // VAPI free phone numbers don't require credentials
        // We'll use the buy endpoint directly
        credentialData = null;
        break;

      default:
        return res.status(400).json({
          success: false,
          message: "Unsupported provider. Supported providers: twilio, vonage, telnyx, vapi"
        });
    }

    // Initialize VAPI service
    const vapiService = new VapiService();

    let vapiPhoneNumber;
    let vapiCredential = null;

    if (provider.toLowerCase() === 'vapi') {
      // VAPI free phone number creation
      // For VAPI, phoneNumber should be the area code (e.g., "415")
      const areaCode = phoneNumber.replace(/\D/g, ''); // Extract digits only

      if (areaCode.length !== 3) {
        return res.status(400).json({
          success: false,
          message: "For VAPI free numbers, please provide a 3-digit area code (e.g., 415)"
        });
      }

      const phoneNumberData = {
        areaCode: areaCode,
        name: name || `VAPI Free Number - ${areaCode}`,
        assistantId: assistantId || undefined,
        squadId: squadId || undefined,
        workflowId: workflowId || undefined,
        fallbackDestination: fallbackDestination ? JSON.parse(fallbackDestination) : undefined,
        server: serverUrl ? {
          url: serverUrl,
          secret: serverUrlSecret
        } : undefined
      };

      console.log('Buying VAPI free phone number:', phoneNumberData);
      vapiPhoneNumber = await vapiService.buyPhoneNumber(phoneNumberData);
      console.log('VAPI phone number response:', JSON.stringify(vapiPhoneNumber, null, 2));
    } else {
      // External provider phone number creation
      // Step 1: Create credential in VAPI
      console.log('Creating credential in VAPI for provider:', provider);
      vapiCredential = await vapiService.createCredential(credentialData);

      // Step 2: Create phone number in VAPI using the credential
      const phoneNumberData = {
        provider: 'byo-phone-number',
        name: name || `Phone Number ${sanitizedPhoneNumber}`,
        number: sanitizedPhoneNumber,
        numberE164CheckEnabled: true,
        credentialId: vapiCredential.id,
        assistantId: assistantId || undefined,
        squadId: squadId || undefined,
        workflowId: workflowId || undefined,
        fallbackDestination: fallbackDestination ? JSON.parse(fallbackDestination) : undefined,
        server: serverUrl ? {
          url: serverUrl,
          secret: serverUrlSecret
        } : undefined
      };

      console.log('Creating phone number in VAPI:', phoneNumberData);
      vapiPhoneNumber = await vapiService.createPhoneNumber(phoneNumberData);
      console.log('VAPI phone number response:', JSON.stringify(vapiPhoneNumber, null, 2));
    }

    // Step 3: Store in local database with user association
    const PhoneNumberModel = require("../../model/PhoneNumberModel/PhoneNumberModel");

    const phoneNumberRecord = {
      user_id: currentUserId,
      phone_number_id: vapiPhoneNumber.id || null,
      org_id: vapiPhoneNumber.orgId || null,
      number: vapiPhoneNumber.number || (provider.toLowerCase() === 'vapi' ? phoneNumber : sanitizedPhoneNumber),
      country_code: vapiPhoneNumber.countryCode || null,
      provider: provider.toLowerCase(),
      type: provider.toLowerCase() === 'vapi' ? 'local' : 'local', // Use 'local' for now, will fix schema later
      capabilities: vapiPhoneNumber.capabilities || {},
      sip_uri: vapiPhoneNumber.sipUri || null,
      fallback_destination: fallbackDestination || null,
      assistant_id: assistantId || null,
      squad_id: squadId || null,
      workflow_id: workflowId || null,
      status: 'active',
      metadata: {
        credentialId: vapiCredential?.id || null,
        name: name || null,
        serverUrl: serverUrl || null,
        serverUrlSecret: serverUrlSecret || null,
        originalProvider: provider.toLowerCase(),
        originalPhoneNumber: phoneNumber,
        ...(provider.toLowerCase() === 'vapi' && { areaCode: phoneNumber.replace(/\D/g, '') })
      }
    };

    console.log('Phone number record to be inserted:', JSON.stringify(phoneNumberRecord, null, 2));
    await PhoneNumberModel.createPhoneNumber(phoneNumberRecord);

    res.status(201).json({
      success: true,
      message: provider.toLowerCase() === 'vapi'
        ? "VAPI free phone number created successfully"
        : "Phone number created successfully",
      data: {
        ...vapiPhoneNumber,
        credentialId: vapiCredential?.id || null,
        provider: provider.toLowerCase(),
        type: provider.toLowerCase() === 'vapi' ? 'local' : 'local' // Use 'local' for now
      }
    });

  } catch (error) {
    console.error("Error creating phone number:", error);

    // Handle specific VAPI errors
    if (error.response?.data) {
      const vapiError = error.response.data;
      console.error("VAPI Error Details:", vapiError);

      // Handle common VAPI error scenarios
      if (vapiError.message?.includes('credential')) {
        return res.status(400).json({
          success: false,
          message: "Invalid credentials provided. Please check your provider credentials."
        });
      }

      if (vapiError.message?.includes('phone number')) {
        return res.status(400).json({
          success: false,
          message: "Phone number validation failed. Please check the phone number format."
        });
      }

      if (vapiError.message?.includes('duplicate')) {
        return res.status(409).json({
          success: false,
          message: "This phone number is already registered in VAPI."
        });
      }
    }

    // Handle network errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        success: false,
        message: "Unable to connect to VAPI service. Please try again later."
      });
    }

    // Generic error response
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message || "Failed to create phone number";

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Update phone number with user isolation
const updatePhoneNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    const PhoneNumberModel = require("../../model/PhoneNumberModel/PhoneNumberModel");

    // Check if user has access to this phone number
    if (!isSuperAdmin) {
      const hasAccess = await PhoneNumberModel.phoneNumberExistsForUser(id, currentUserId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only update your own phone numbers."
        });
      }
    }

    // Update in VAPI first
    const response = await axios.patch(
      `${VAPI_BASE_URL}/phone-number/${id}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Update in local database
    await PhoneNumberModel.updatePhoneNumber(id, currentUserId, {
      assistant_id: updateData.assistantId,
      squad_id: updateData.squadId,
      workflow_id: updateData.workflowId,
      fallback_destination: updateData.fallbackDestination,
      metadata: updateData.metadata || {}
    });

    res.status(200).json({
      success: true,
      message: "Phone number updated successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error updating phone number:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to update phone number",
      error: error.response?.data || error.message
    });
  }
};

// Delete phone number with user isolation
const deletePhoneNumber = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    const PhoneNumberModel = require("../../model/PhoneNumberModel/PhoneNumberModel");

    // Check if user has access to this phone number
    if (!isSuperAdmin) {
      const hasAccess = await PhoneNumberModel.phoneNumberExistsForUser(id, currentUserId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: "Access denied. You can only delete your own phone numbers."
        });
      }
    }

    // Delete from VAPI first
    await axios.delete(`${VAPI_BASE_URL}/phone-number/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    // Delete from local database
    await PhoneNumberModel.deletePhoneNumber(id, currentUserId);

    res.status(200).json({
      success: true,
      message: "Phone number deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting phone number:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete phone number",
      error: error.response?.data || error.message
    });
  }
};

// Buy phone number (Twilio integration)
const buyPhoneNumber = async (req, res) => {
  try {
    const { areaCode, countryCode, phoneNumber, twilioAccountSid, twilioAuthToken } = req.body;

    if (!twilioAccountSid || !twilioAuthToken) {
      return res.status(400).json({
        success: false,
        message: "Twilio account SID and auth token are required"
      });
    }

    // This would integrate with Twilio to purchase a phone number
    // For now, we'll return a mock response
    const mockPurchasedNumber = {
      phoneNumber: phoneNumber || `+1${areaCode}5551234`,
      friendlyName: `Purchased Number ${Date.now()}`,
      capabilities: {
        voice: true,
        sms: true,
        mms: false
      },
      status: "purchased",
      cost: "$1.00"
    };

    res.status(201).json({
      success: true,
      message: "Phone number purchased successfully",
      data: mockPurchasedNumber
    });
  } catch (error) {
    console.error("Error purchasing phone number:", error);
    res.status(500).json({
      success: false,
      message: "Failed to purchase phone number",
      error: error.message
    });
  }
};

// Search available phone numbers
const searchPhoneNumbers = async (req, res) => {
  try {
    const { areaCode, countryCode, contains, nearLatLong } = req.query;

    // Mock available numbers - in real implementation, this would query Twilio
    const mockAvailableNumbers = [
      { phoneNumber: `+1${areaCode || '555'}1234567`, locality: "New York", region: "NY", cost: "$1.00" },
      { phoneNumber: `+1${areaCode || '555'}2345678`, locality: "New York", region: "NY", cost: "$1.00" },
      { phoneNumber: `+1${areaCode || '555'}3456789`, locality: "New York", region: "NY", cost: "$1.00" },
      { phoneNumber: `+1${areaCode || '555'}4567890`, locality: "New York", region: "NY", cost: "$1.00" },
      { phoneNumber: `+1${areaCode || '555'}5678901`, locality: "New York", region: "NY", cost: "$1.00" }
    ];

    res.status(200).json({
      success: true,
      message: "Available phone numbers retrieved successfully",
      data: mockAvailableNumbers
    });
  } catch (error) {
    console.error("Error searching phone numbers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to search phone numbers",
      error: error.message
    });
  }
};

module.exports = {
  listPhoneNumbers,
  getPhoneNumber,
  createPhoneNumber,
  updatePhoneNumber,
  deletePhoneNumber,
  buyPhoneNumber,
  searchPhoneNumbers
};
