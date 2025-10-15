 const AssistantModel = require("../../model/AssistantModel/AssistantModel");
require("dotenv").config({ path: "./config/config.env" });
const axios = require("axios");
const jwt = require("jsonwebtoken");

// Use environment variable with fallback to hardcoded key for consistency
const KEY = process.env.VAPI_SECRET_KEY || "aa6161d2-7ba0-4182-96aa-fee4a9f14fd8";

console.log("Assistant Controller - VAPI_SECRET_KEY loaded:", KEY ? "✓" : "✗");

//const KEY = "bc725647-fc1b-45a5-93a5-57b784e65cc6";

async function createAssistant(req, res) {
  console.log("🚀 Creating VAPI Assistant with full feature support");
  try {
    const assistantData = req.body;

    // Extract and validate required fields
    const {
      name,
      firstMessage,
      transcriber,
      model,
      voice,
      // Optional VAPI-specific fields
      firstMessageMode,
      firstMessageInterruptionsEnabled,
      voicemailMessage,
      endCallMessage,
      endCallPhrases,
      maxDurationSeconds,
      backgroundSound,
      modelOutputInMessagesEnabled,
      clientMessages,
      serverMessages,
      voicemailDetection,
      transportConfigurations,
      observabilityPlan,
      credentials,
      hooks,
      compliancePlan,
      metadata,
      backgroundSpeechDenoisingPlan,
      analysisPlan,
      artifactPlan,
      startSpeakingPlan,
      stopSpeakingPlan,
      monitorPlan,
      credentialIds,
      server,
      keypadInputPlan
    } = assistantData;

    // Clean voice configuration to remove unsupported properties
    const cleanedVoice = voice ? cleanVoiceConfig(voice) : voice;

    // Clean model configuration to remove unsupported properties
    const cleanedModel = model ? cleanModelConfig(model) : model;

    // Build comprehensive VAPI payload
    const payload = {
      name,
      firstMessage,
      transcriber,
      model: cleanedModel,
      voice: cleanedVoice,
      // Add all VAPI-specific features
      ...(firstMessageMode && { firstMessageMode }),
      ...(firstMessageInterruptionsEnabled !== undefined && { firstMessageInterruptionsEnabled }),
      ...(voicemailMessage && { voicemailMessage }),
      ...(endCallMessage && { endCallMessage }),
      ...(endCallPhrases && { endCallPhrases }),
      ...(maxDurationSeconds && { maxDurationSeconds }),
      ...(backgroundSound && { backgroundSound }),
      ...(modelOutputInMessagesEnabled !== undefined && { modelOutputInMessagesEnabled }),
      ...(clientMessages && { clientMessages }),
      ...(serverMessages && { serverMessages }),
      ...(voicemailDetection && { voicemailDetection }),
      ...(transportConfigurations && { transportConfigurations }),
      ...(observabilityPlan && { observabilityPlan }),
      ...(credentials && { credentials }),
      ...(hooks && { hooks }),
      ...(compliancePlan && { compliancePlan }),
      ...(metadata && { metadata }),
      ...(backgroundSpeechDenoisingPlan && { backgroundSpeechDenoisingPlan }),
      ...(analysisPlan && { analysisPlan }),
      ...(artifactPlan && { artifactPlan }),
      ...(startSpeakingPlan && { startSpeakingPlan }),
      ...(stopSpeakingPlan && { stopSpeakingPlan }),
      ...(monitorPlan && { monitorPlan }),
      ...(credentialIds && { credentialIds }),
      ...(server && { server }),
      ...(keypadInputPlan && { keypadInputPlan })
    };

    console.log('🔧 Enhanced VAPI payload:', JSON.stringify(payload, null, 2));

    const vapiResponse = await axios.post(
      "https://api.vapi.ai/assistant",
      payload,
      {
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const newAssistant = vapiResponse.data;
    console.log("✅ VAPI returned new assistant:", newAssistant);

    if (vapiResponse.status !== 201 && vapiResponse.status !== 200) {
      throw new Error(
        `Vapi responded with unexpected status: ${vapiResponse.status}`
      );
    }

    const token = req.headers["authorization"].split(" ")[1];

    const decodedToken = jwt.verify(token, "ASAJKLDSLKDJLASJDLA");

    // Handle different token structures
    let user_id;
    if (decodedToken.user && decodedToken.user.id) {
      // Regular login structure
      user_id = decodedToken.user.id;
    } else if (decodedToken.id) {
      // Demo login structure
      user_id = decodedToken.id;
    }

    // Store in local database
    console.log('🔄 Storing assistant in local database...');
    try {
      const localId = await AssistantModel.createAssistantRecord(
        user_id,
        newAssistant.id,
        newAssistant.orgId,
        newAssistant.name || null,
        newAssistant.firstMessage || null,
        newAssistant
      );
      console.log('✅ Assistant stored in local DB with ID:', localId);

      res.status(201).json({
        success: true,
        message: "Assistant created successfully in both VAPI and local database",
        data: newAssistant,
        localId: localId
      });
    } catch (dbError) {
      console.error('❌ Failed to store assistant in local database:', dbError);
      // VAPI creation was successful, but local DB failed
      res.status(201).json({
        success: true,
        message: "Assistant created in VAPI, but local database storage failed",
        data: newAssistant,
        warning: "Local database sync failed: " + dbError.message
      });
    }
  } catch (error) {
    console.error("Error creating assistant:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create assistant",
      error: error.message,
    });
  }
}

const getAssistants = async (req, res) => {
  console.log("🔍 Getting assistants with sync verification...");
  const pageParam = parseInt(req.query.page);
  const limitParam = parseInt(req.query.limit);
  const search = req.query.search || "";
  const syncCheck = req.query.syncCheck === 'true'; // Optional sync verification

  const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

  try {
    // Get current user ID for filtering
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    // Super admin can see all assistants, regular users only see their own
    const userId = isSuperAdmin ? null : currentUserId;

    // Get assistants from local database
    const { data: localAssistants, totalAssistant } = await AssistantModel.getAssistants(
      page,
      limit,
      search,
      userId
    );

    if (!localAssistants || localAssistants.length === 0) {
      console.log("📭 No assistants found for user");
      return res.status(200).json({
        data: [],
        totalAssistant: 0,
        currentPage: 1,
        totalPages: 0,
        syncVerified: syncCheck,
        message: "No assistants created yet"
      });
    }

    let syncedAssistants = localAssistants;

    // Optional: Verify sync with VAPI (only if requested to avoid performance impact)
    if (syncCheck) {
      console.log('🔄 Performing sync verification with VAPI...');
      const syncedData = [];

      for (const assistant of localAssistants) {
        try {
          // Check if assistant still exists in VAPI
          const vapiResponse = await axios.get(`https://api.vapi.ai/assistant/${assistant.assistant_id}`, {
            headers: { Authorization: `Bearer ${KEY}` }
          });

          if (vapiResponse.status === 200) {
            // Assistant exists in both - include it
            syncedData.push({
              ...assistant,
              vapiSyncStatus: 'synced',
              lastVapiCheck: new Date().toISOString()
            });
          }
        } catch (error) {
          if (error.response?.status === 404) {
            // Assistant deleted from VAPI - mark as orphaned
            console.warn(`⚠️ Assistant ${assistant.assistant_id} not found in VAPI`);
            syncedData.push({
              ...assistant,
              vapiSyncStatus: 'orphaned',
              lastVapiCheck: new Date().toISOString()
            });
          } else {
            // VAPI error - include but mark as unknown
            syncedData.push({
              ...assistant,
              vapiSyncStatus: 'unknown',
              lastVapiCheck: new Date().toISOString()
            });
          }
        }
      }
      syncedAssistants = syncedData;
    }

    // Calculate total pages
    const totalPages = Math.ceil(totalAssistant / limit);
    const currentPage = page > totalPages && totalPages > 0 ? totalPages : page;

    res.status(200).json({
      data: syncedAssistants,
      totalAssistant,
      currentPage,
      totalPages,
      syncVerified: syncCheck
    });
  } catch (error) {
    console.error("Error getting assistants:", error);
    res.status(400).json({
      success: false,
      message: "Failed to get assistants",
      error: error.message
    });
  }
};
const getAssistantsFromVapi = async (req, res) => {
  const id = req.params.id;

  console.log("🔍 Getting assistant from VAPI with ID:", id);
  try {
    const token = req.headers["authorization"].split(" ")[1];
    const decodedToken = jwt.verify(token, "ASAJKLDSLKDJLASJDLA");

    // Handle different token structures
    let user_id;
    if (decodedToken.user && decodedToken.user.id) {
      // Regular login structure
      user_id = decodedToken.user.id;
    } else if (decodedToken.id) {
      // Demo login structure
      user_id = decodedToken.id;
    }

    if (!user_id) {
      return res.status(401).json({
        message: "You don't have permission to view this Assistant"
      });
    }

    let vapiId = id;

    // Check if the ID is a UUID (VAPI format) or a local database ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(id)) {
      // This is likely a local database ID, need to get the VAPI UUID
      console.log("🔄 ID is not a UUID, looking up assistant_id from local DB...");

      try {
        const db = require("../../config/DBConnection");
        const [rows] = await db.query(
          "SELECT assistant_id FROM assistants WHERE id = ? AND user_id = ?",
          [id, user_id]
        );

        if (rows.length === 0) {
          return res.status(404).json({
            success: false,
            message: "Assistant not found in local database",
          });
        }

        vapiId = rows[0].assistant_id;
        console.log("✅ Found VAPI UUID:", vapiId, "for local ID:", id);

        if (!vapiId) {
          return res.status(404).json({
            success: false,
            message: "Assistant has no VAPI ID associated",
          });
        }
      } catch (dbError) {
        console.error("❌ Database error:", dbError);
        return res.status(500).json({
          success: false,
          message: "Failed to lookup assistant in database",
          error: dbError.message,
        });
      }
    }

    // Now fetch from VAPI using the correct UUID
    console.log("🌐 Fetching from VAPI with UUID:", vapiId);
    const response = await axios.get(`https://api.vapi.ai/assistant/${vapiId}`, {
      headers: {
        Authorization: `Bearer ${KEY}`,
      },
    });

    const assistants = response.data;
    return res.status(200).json({
      success: true,
      message: "Assistant retrieved successfully",
      data: assistants,
    });

  } catch (error) {
    console.error(
      "❌ Error fetching assistant:",
      error?.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      message: "Failed to fetch assistant",
      error: error.message,
    });
  }
};

const listAllAssistantsFromVapi = async (req, res) => {
  console.log("Fetching user-specific assistants from VAPI...");
  try {
    // Get current user ID for filtering
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        message: "You don't have permission to view assistants"
      });
    }

    // Super admin can see all assistants, regular users only see their own
    const userId = isSuperAdmin ? null : currentUserId;

    // First get user's assistants from local database to get their VAPI IDs
    const { data: localAssistants } = await AssistantModel.getAssistants(1, 1000, "", userId);

    if (!localAssistants || localAssistants.length === 0) {
      console.log("📭 No assistants found for user in local database");
      return res.status(200).json({
        success: true,
        message: "No assistants found for user",
        data: [],
      });
    }

    // Extract VAPI assistant IDs from local database
    const vapiAssistantIds = localAssistants
      .map(assistant => assistant.assistant_id)
      .filter(id => id); // Filter out null/undefined IDs

    if (vapiAssistantIds.length === 0) {
      console.log("📭 No VAPI assistant IDs found for user");
      return res.status(200).json({
        success: true,
        message: "No VAPI assistants found for user",
        data: [],
      });
    }

    console.log(`🔍 Fetching ${vapiAssistantIds.length} user-specific assistants from VAPI`);

    // Fetch all assistants from VAPI
    const response = await axios.get("https://api.vapi.ai/assistant", {
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json"
      },
    });

    // Handle VAPI's response format
    let allVapiAssistants = [];
    if (Array.isArray(response.data)) {
      allVapiAssistants = response.data;
    } else if (response.data?.results && Array.isArray(response.data.results)) {
      allVapiAssistants = response.data.results;
    } else if (response.data?.data && Array.isArray(response.data.data)) {
      allVapiAssistants = response.data.data;
    }

    // Filter VAPI assistants to only include those belonging to the user
    const userVapiAssistants = allVapiAssistants.filter(assistant =>
      vapiAssistantIds.includes(assistant.id)
    );

    console.log(`✅ Filtered ${userVapiAssistants.length} user-specific assistants from ${allVapiAssistants.length} total VAPI assistants`);

    return res.status(200).json({
      success: true,
      message: "User assistants retrieved successfully from VAPI",
      data: userVapiAssistants,
    });

  } catch (error) {
    console.error(
      "Error fetching user assistants from VAPI:",
      error?.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user assistants from VAPI",
      error: error.message,
    });
  }
};

// Helper function to clean model configuration for VAPI
function cleanModelConfig(model) {
  if (!model) {
    return model;
  }

  const cleanedModel = {
    provider: model.provider,
    model: model.model
  };

  // Add supported properties
  if (model.temperature !== undefined) cleanedModel.temperature = model.temperature;
  if (model.maxTokens !== undefined) cleanedModel.maxTokens = model.maxTokens;
  if (model.topP !== undefined) cleanedModel.topP = model.topP;
  if (model.frequencyPenalty !== undefined) cleanedModel.frequencyPenalty = model.frequencyPenalty;
  if (model.presencePenalty !== undefined) cleanedModel.presencePenalty = model.presencePenalty;
  if (model.numFastTurns !== undefined) cleanedModel.numFastTurns = model.numFastTurns;
  if (model.messages && Array.isArray(model.messages)) cleanedModel.messages = model.messages;
  if (model.tools && Array.isArray(model.tools)) cleanedModel.tools = model.tools;
  if (model.toolIds && Array.isArray(model.toolIds)) cleanedModel.toolIds = model.toolIds;

  // Remove any unsupported properties like 'thinking', 'emotionRecognitionEnabled'
  console.log('🔧 Cleaned model config - removed unsupported properties like thinking, emotionRecognitionEnabled');

  return cleanedModel;
}

// Enhanced helper function to clean voice configuration with full VAPI support
function cleanVoiceConfig(voice) {
  if (!voice || !voice.provider) {
    return voice;
  }

  const cleanedVoice = {
    provider: voice.provider,
    voiceId: voice.voiceId
  };

  // Add VAPI-universal properties
  if (voice.cachingEnabled !== undefined) cleanedVoice.cachingEnabled = voice.cachingEnabled;
  if (voice.speed !== undefined) cleanedVoice.speed = voice.speed;

  // Add chunk plan if present
  if (voice.chunkPlan) {
    cleanedVoice.chunkPlan = {
      enabled: voice.chunkPlan.enabled || false
    };

    if (voice.chunkPlan.enabled) {
      if (voice.chunkPlan.minCharacters !== undefined) {
        cleanedVoice.chunkPlan.minCharacters = voice.chunkPlan.minCharacters;
      }
      if (voice.chunkPlan.punctuationBoundaries) {
        cleanedVoice.chunkPlan.punctuationBoundaries = voice.chunkPlan.punctuationBoundaries;
      }

      // Add format plan if present
      if (voice.chunkPlan.formatPlan) {
        cleanedVoice.chunkPlan.formatPlan = {
          enabled: voice.chunkPlan.formatPlan.enabled || false
        };

        if (voice.chunkPlan.formatPlan.enabled) {
          if (voice.chunkPlan.formatPlan.numberToDigitsCutoff !== undefined) {
            cleanedVoice.chunkPlan.formatPlan.numberToDigitsCutoff = voice.chunkPlan.formatPlan.numberToDigitsCutoff;
          }
          if (voice.chunkPlan.formatPlan.replacements) {
            cleanedVoice.chunkPlan.formatPlan.replacements = voice.chunkPlan.formatPlan.replacements;
          }
          if (voice.chunkPlan.formatPlan.formattersEnabled) {
            cleanedVoice.chunkPlan.formatPlan.formattersEnabled = voice.chunkPlan.formatPlan.formattersEnabled;
          }
        }
      }
    }
  }

  // Add fallback plan if present
  if (voice.fallbackPlan && voice.fallbackPlan.voices) {
    cleanedVoice.fallbackPlan = {
      voices: voice.fallbackPlan.voices.map(fallbackVoice => cleanVoiceConfig(fallbackVoice))
    };
  }

  // Provider-specific properties
  if (voice.provider === 'cartesia') {
    // Cartesia supports basic properties + VAPI universal features
    console.log('🎵 Enhanced Cartesia voice config with VAPI features');
  } else if (voice.provider === '11labs') {
    // 11labs supports additional properties
    if (voice.stability !== undefined) cleanedVoice.stability = voice.stability;
    if (voice.similarityBoost !== undefined) cleanedVoice.similarityBoost = voice.similarityBoost;
    if (voice.style !== undefined) cleanedVoice.style = voice.style;
    if (voice.useSpeakerBoost !== undefined) cleanedVoice.useSpeakerBoost = voice.useSpeakerBoost;
    console.log('🎵 Enhanced 11labs voice config with VAPI features');
  } else if (voice.provider === 'vapi') {
    // VAPI native voices support all features
    console.log('🎵 VAPI native voice config - all features supported');
  } else {
    // Other providers support basic features
    console.log(`🎵 Enhanced ${voice.provider} voice config with VAPI features`);
  }

  return cleanedVoice;
}

async function updateAssistant(req, res) {
  console.log('🔄 Starting assistant update for ID:', req.params.id);
  console.log('🔍 Update user context:');
  console.log('  - User ID:', req.user?.user?.id || req.user?.id);
  console.log('  - Is Super Admin:', req.user?.isSuperAdmin);
  try {
    const { id } = req.params;

    // Clean the payload to remove unsupported properties
    const payload = { ...req.body };

    // Clean voice configuration if present
    if (payload.voice) {
      payload.voice = cleanVoiceConfig(payload.voice);
      console.log('🔧 Cleaned voice config:', JSON.stringify(payload.voice, null, 2));
    }

    // Clean model configuration if present
    if (payload.model) {
      payload.model = cleanModelConfig(payload.model);
      console.log('🔧 Cleaned model config:', JSON.stringify(payload.model, null, 2));
    }

    console.log('📤 Sending payload to VAPI:', JSON.stringify(payload, null, 2));

    // Update in VAPI first
    const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!vapiResponse.ok) {
      const errorBody = await vapiResponse.text();
      console.error("❌ VAPI error body:", errorBody);
      return res.status(vapiResponse.status).json({
        success: false,
        message: `Vapi responded with status ${vapiResponse.status}`,
        error: errorBody,
      });
    }

    const updatedAssistant = await vapiResponse.json();
    console.log("✅ Updated assistant from VAPI:", updatedAssistant.name);

    // Update local database
    console.log('🔄 Updating local database record...');
    try {
      const affectedRows = await AssistantModel.updateAssistantRecord(
        updatedAssistant.id,
        updatedAssistant
      );
      console.log('✅ Database update result:', affectedRows, 'rows affected');

      if (affectedRows === 0) {
        console.warn('⚠️ No rows were updated in local database - assistant might not exist locally');
      }

      return res.status(200).json({
        success: true,
        message: "Assistant updated successfully in both VAPI and local database",
        data: updatedAssistant,
        dbRowsUpdated: affectedRows,
      });
    } catch (dbError) {
      console.error('❌ Database update failed:', dbError);
      // VAPI was updated successfully, but local DB failed
      return res.status(200).json({
        success: true,
        message: "Assistant updated in VAPI, but local database update failed",
        data: updatedAssistant,
        dbRowsUpdated: 0,
        warning: "Local database sync failed: " + dbError.message
      });
    }
  } catch (error) {
    console.error("❌ Error updating assistant:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update assistant",
      error: error.message,
    });
  }
}

async function deleteAssistant(req, res) {
  try {
    const { id } = req.params;
    console.log('🗑️ Deleting assistant with ID:', id);

    let vapiDeleteResult = null;
    let vapiDeleteSuccess = false;

    // Try to delete from VAPI first (if it exists there)
    try {
      const vapiResponse = await fetch(`https://api.vapi.ai/assistant/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${KEY}`,
          "Content-Type": "application/json",
        },
      });

      if (vapiResponse.ok) {
        try {
          vapiDeleteResult = await vapiResponse.json();
          vapiDeleteSuccess = true;
          console.log('✅ Successfully deleted from VAPI:', id);
        } catch (_ignore) {
          vapiDeleteResult = {};
          vapiDeleteSuccess = true;
        }
      } else if (vapiResponse.status === 404) {
        // Assistant doesn't exist in VAPI, that's okay
        console.log('ℹ️ Assistant not found in VAPI (404), proceeding with local deletion:', id);
        vapiDeleteSuccess = true;
      } else {
        // Other VAPI errors
        const errorBody = await vapiResponse.text();
        console.warn('⚠️ VAPI deletion failed, but proceeding with local deletion:', errorBody);
        vapiDeleteSuccess = false; // Continue anyway
      }
    } catch (vapiError) {
      console.warn('⚠️ VAPI deletion error, but proceeding with local deletion:', vapiError.message);
      vapiDeleteSuccess = false; // Continue anyway
    }

    // Always try to delete from local database
    const dbRowsDeleted = await AssistantModel.deleteAssistantRecordById(id);
    console.log('🗄️ Database deletion result:', dbRowsDeleted);

    if (dbRowsDeleted > 0) {
      return res.status(200).json({
        success: true,
        message: "Assistant deleted successfully",
        data: {
          vapiDeleteResult: vapiDeleteResult,
          vapiDeleteSuccess: vapiDeleteSuccess,
          dbRowsDeleted,
        },
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Assistant not found in database",
        data: {
          vapiDeleteResult: vapiDeleteResult,
          vapiDeleteSuccess: vapiDeleteSuccess,
          dbRowsDeleted,
        },
      });
    }
  } catch (error) {
    console.error("Error deleting assistant:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete assistant",
      error: error.message,
    });
  }
}

// Get assistants that exist in both local DB and VAPI (fully synced)
const getSyncedAssistants = async (req, res) => {
  console.log("🔄 Getting fully synced assistants...");
  const pageParam = parseInt(req.query.page);
  const limitParam = parseInt(req.query.limit);
  const search = req.query.search || "";

  const page = !isNaN(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = !isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

  try {
    // Get current user ID for filtering
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    console.log('🔍 User context for synced assistants:');
    console.log('  - Current User ID:', currentUserId);
    console.log('  - Is Super Admin:', isSuperAdmin);
    console.log('  - Full req.user:', JSON.stringify(req.user, null, 2));

    // Super admin can see all assistants, regular users only see their own
    const userId = isSuperAdmin ? null : currentUserId;

    // Get all assistants from local database (without pagination first)
    const { data: allLocalAssistants } = await AssistantModel.getAssistants(1, 1000, search, userId);

    if (!allLocalAssistants || allLocalAssistants.length === 0) {
      console.log("📭 No assistants found for user");
      return res.status(200).json({
        data: [],
        totalAssistant: 0,
        currentPage: 1,
        totalPages: 0,
        syncVerified: true,
        message: "No assistants created yet"
      });
    }

    console.log(`🔍 Checking ${allLocalAssistants.length} local assistants against VAPI...`);
    const syncedAssistants = [];

    // Check each local assistant against VAPI
    for (const assistant of allLocalAssistants) {
      try {
        const vapiResponse = await axios.get(`https://api.vapi.ai/assistant/${assistant.assistant_id}`, {
          headers: { Authorization: `Bearer ${KEY}` }
        });

        if (vapiResponse.status === 200) {
          // Assistant exists in both - add to synced list
          syncedAssistants.push({
            ...assistant,
            vapiData: vapiResponse.data,
            syncStatus: 'synced',
            lastSyncCheck: new Date().toISOString()
          });
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.warn(`⚠️ Assistant ${assistant.name} (${assistant.assistant_id}) not found in VAPI - skipping`);
        } else {
          console.error(`❌ Error checking assistant ${assistant.assistant_id}:`, error.message);
        }
        // Don't include assistants that don't exist in VAPI or have errors
      }
    }

    console.log(`✅ Found ${syncedAssistants.length} fully synced assistants`);

    // Apply pagination to synced results
    const totalSynced = syncedAssistants.length;
    const totalPages = Math.ceil(totalSynced / limit);
    const currentPage = page > totalPages && totalPages > 0 ? totalPages : page;
    const offset = (currentPage - 1) * limit;
    const paginatedResults = syncedAssistants.slice(offset, offset + limit);

    res.status(200).json({
      data: paginatedResults,
      totalAssistant: totalSynced,
      currentPage,
      totalPages,
      syncVerified: true,
      message: `Found ${totalSynced} assistants that exist in both local DB and VAPI`
    });
  } catch (error) {
    console.error("Error getting synced assistants:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get synced assistants",
      error: error.message
    });
  }
};

module.exports = {
  createAssistant,
  getAssistants,
  getAssistantsFromVapi,
  listAllAssistantsFromVapi,
  updateAssistant,
  deleteAssistant,
  getSyncedAssistants,
};
