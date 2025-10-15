const DefaultAssistantTemplateModel = require("../../model/DefaultAssistantTemplateModel/DefaultAssistantTemplateModel");

// Create a new default assistant template
async function createDefaultAssistantTemplate(req, res) {
  console.log("🚀 Creating default assistant template");
  console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
  try {
    const templateData = {
      ...req.body,
      created_by: req.user.id
    };
    console.log("📝 Template data with created_by:", JSON.stringify(templateData, null, 2));

    // Validate required fields
    if (!templateData.name || !templateData.description) {
      return res.status(400).json({
        success: false,
        message: "Name and description are required"
      });
    }

    const template = await DefaultAssistantTemplateModel.createDefaultAssistantTemplate(templateData);

    res.status(201).json({
      success: true,
      message: "Default assistant template created successfully",
      data: template
    });

  } catch (error) {
    console.error("❌ Error creating default assistant template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create default assistant template",
      error: error.message
    });
  }
}

// Get all default assistant templates
async function getAllDefaultAssistantTemplates(req, res) {
  console.log("📋 Fetching all default assistant templates");
  try {
    const filters = {
      is_active: req.query.is_active !== undefined ? req.query.is_active === 'true' : undefined,
      category: req.query.category,
      is_featured: req.query.is_featured !== undefined ? req.query.is_featured === 'true' : undefined
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => filters[key] === undefined && delete filters[key]);

    const templates = await DefaultAssistantTemplateModel.getAllDefaultAssistantTemplates(filters);

    res.status(200).json({
      success: true,
      message: "Default assistant templates retrieved successfully",
      data: templates,
      count: templates.length
    });

  } catch (error) {
    console.error("❌ Error fetching default assistant templates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch default assistant templates",
      error: error.message
    });
  }
}

// Get default assistant template by ID
async function getDefaultAssistantTemplateById(req, res) {
  console.log("🔍 Fetching default assistant template by ID:", req.params.id);
  try {
    const template = await DefaultAssistantTemplateModel.getDefaultAssistantTemplateById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Default assistant template not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Default assistant template retrieved successfully",
      data: template
    });

  } catch (error) {
    console.error("❌ Error fetching default assistant template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch default assistant template",
      error: error.message
    });
  }
}

// Update default assistant template
async function updateDefaultAssistantTemplate(req, res) {
  console.log("✏️ Updating default assistant template:", req.params.id);
  try {
    const templateData = req.body;
    const updated_by = req.user.id;

    const template = await DefaultAssistantTemplateModel.updateDefaultAssistantTemplate(
      req.params.id,
      templateData,
      updated_by
    );

    res.status(200).json({
      success: true,
      message: "Default assistant template updated successfully",
      data: template
    });

  } catch (error) {
    console.error("❌ Error updating default assistant template:", error);
    
    if (error.message === 'Template not found or no changes made') {
      return res.status(404).json({
        success: false,
        message: "Default assistant template not found"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update default assistant template",
      error: error.message
    });
  }
}

// Delete default assistant template
async function deleteDefaultAssistantTemplate(req, res) {
  console.log("🗑️ Deleting default assistant template:", req.params.id);
  try {
    await DefaultAssistantTemplateModel.deleteDefaultAssistantTemplate(req.params.id);

    res.status(200).json({
      success: true,
      message: "Default assistant template deleted successfully"
    });

  } catch (error) {
    console.error("❌ Error deleting default assistant template:", error);
    
    if (error.message === 'Template not found') {
      return res.status(404).json({
        success: false,
        message: "Default assistant template not found"
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to delete default assistant template",
      error: error.message
    });
  }
}

// Get template categories
async function getTemplateCategories(req, res) {
  console.log("📂 Fetching template categories");
  try {
    const categories = await DefaultAssistantTemplateModel.getTemplateCategories();

    res.status(200).json({
      success: true,
      message: "Template categories retrieved successfully",
      data: categories
    });

  } catch (error) {
    console.error("❌ Error fetching template categories:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch template categories",
      error: error.message
    });
  }
}

// Use template (increment usage count and return template data)
async function useTemplate(req, res) {
  console.log("🎯 Using template:", req.params.id);
  try {
    const template = await DefaultAssistantTemplateModel.getDefaultAssistantTemplateById(req.params.id);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Default assistant template not found"
      });
    }

    if (!template.is_active) {
      return res.status(400).json({
        success: false,
        message: "Template is not active"
      });
    }

    // Increment usage count
    await DefaultAssistantTemplateModel.incrementTemplateUsage(req.params.id);

    // Return template data for assistant creation
    const assistantData = {
      name: template.name,
      firstMessage: template.first_message,
      systemMessage: template.system_message,
      first_message: template.first_message,
      system_message: template.system_message,
      model: template.model,
      voice: template.voice,
      transcriber: template.transcriber,
      functions: template.functions,
      endCallMessage: template.end_call_message,
      endCallPhrases: template.end_call_phrases,
      metadata: {
        ...template.metadata,
        template_id: template.template_id,
        template_name: template.name
      },
      backgroundSound: template.background_sound,
      backchannelEnabled: template.backchannel_enabled,
      backgroundDenoisingEnabled: template.background_denoising_enabled,
      modelOutputInMessagesEnabled: template.model_output_in_messages_enabled,
      transportConfigurations: template.transport_configurations,
      artifactPlan: template.artifact_plan,
      messagePlan: template.message_plan,
      startSpeakingPlan: template.start_speaking_plan,
      stopSpeakingPlan: template.stop_speaking_plan,
      monitorPlan: template.monitor_plan,
      credentialIds: template.credential_ids,
      server: template.server_url ? {
        url: template.server_url,
        secret: template.server_url_secret
      } : undefined,
      analysisPlan: template.analysis_plan,
      maxDurationSeconds: template.max_duration_seconds,
      silenceTimeoutSeconds: template.silence_timeout_seconds,
      responseDelaySeconds: template.response_delay_seconds,
      llmRequestDelaySeconds: template.llm_request_delay_seconds,
      numWordsToInterruptAssistant: template.num_words_to_interrupt_assistant,
      maxWordsPerSpokenResponse: template.max_words_per_spoken_response,
      voiceActivityDetection: template.voice_activity_detection,
      hipaaEnabled: template.hipaa_enabled,
      clientMessages: template.client_messages,
      serverMessages: template.server_messages
    };

    res.status(200).json({
      success: true,
      message: "Template data retrieved successfully",
      data: assistantData,
      template: {
        id: template.template_id,
        name: template.name,
        description: template.description,
        category: template.category
      }
    });

  } catch (error) {
    console.error("❌ Error using template:", error);
    res.status(500).json({
      success: false,
      message: "Failed to use template",
      error: error.message
    });
  }
}

module.exports = {
  createDefaultAssistantTemplate,
  getAllDefaultAssistantTemplates,
  getDefaultAssistantTemplateById,
  updateDefaultAssistantTemplate,
  deleteDefaultAssistantTemplate,
  getTemplateCategories,
  useTemplate
};
