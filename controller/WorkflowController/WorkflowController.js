const axios = require("axios");
const { v4: uuidv4 } = require('uuid');
const WorkflowModel = require("../../model/WorkflowModel/WorkflowModel");
const VapiService = require("../../services/VapiService");

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// List all workflows with proper user isolation
const listWorkflows = async (req, res) => {
  try {
    const { page = 1, limit = 10, search = "" } = req.query;
    const currentUserId = req.user?.user?.id || req.user?.id;
    const isSuperAdmin = req.user?.isSuperAdmin || false;

    console.log("Fetching workflows with user isolation...");
    console.log("User ID:", currentUserId, "Super Admin:", isSuperAdmin);

    // Get local workflow records first (these are already filtered by user)
    const localWorkflows = await WorkflowModel.getWorkflowsByUserId(currentUserId, {
      page: parseInt(page),
      limit: parseInt(limit),
      search
    });

    let vapiWorkflows = [];

    // Only fetch VAPI workflows that belong to this user
    if (localWorkflows.workflows.length > 0) {
      const userWorkflowIds = localWorkflows.workflows.map(w => w.workflow_id);

      // Try to get specific workflows from Vapi API
      try {
        // Get all workflows from VAPI and filter by user's workflow IDs
        const response = await axios.get(`${VAPI_BASE_URL}/workflow`, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });

        const allVapiWorkflows = Array.isArray(response.data) ? response.data : [];
        // Filter to only include workflows that belong to this user
        vapiWorkflows = allVapiWorkflows.filter(workflow =>
          userWorkflowIds.includes(workflow.id)
        );
      } catch (vapiError) {
        console.warn("Vapi API error, falling back to local workflows:", vapiError.response?.data || vapiError.message);
        // Continue with empty Vapi workflows array
      }
    }

    // Merge VAPI workflows with local data
    let mergedWorkflows = [];
    if (vapiWorkflows.length > 0) {
      mergedWorkflows = vapiWorkflows.map(vapiWorkflow => {
        const localWorkflow = localWorkflows.workflows.find(
          local => local.workflow_id === vapiWorkflow.id
        );
        return {
          ...vapiWorkflow,
          localData: localWorkflow || null
        };
      });
    } else {
      // If no Vapi workflows, return local workflows with mock structure
      mergedWorkflows = localWorkflows.workflows.map(localWorkflow => ({
        id: localWorkflow.workflow_id,
        name: localWorkflow.name,
        description: localWorkflow.description,
        nodes: localWorkflow.nodes || [],
        edges: localWorkflow.edges || [],
        createdAt: localWorkflow.created_at,
        updatedAt: localWorkflow.updated_at,
        localData: localWorkflow
      }));
    }

    console.log("Workflows fetched successfully:", mergedWorkflows.length, "workflows for user");

    res.status(200).json({
      success: true,
      message: "Workflows retrieved successfully",
      data: {
        workflows: mergedWorkflows,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(Math.max(vapiWorkflows.length, localWorkflows.workflows.length) / parseInt(limit)),
          totalItems: Math.max(vapiWorkflows.length, localWorkflows.workflows.length),
          itemsPerPage: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error("Error listing workflows:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve workflows",
      error: error.message
    });
  }
};

// Get workflow by ID
const getWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Get local workflow data first
    const localWorkflow = await WorkflowModel.getWorkflowByWorkflowId(id);

    if (!localWorkflow) {
      return res.status(404).json({
        success: false,
        message: "Workflow not found"
      });
    }

    let vapiWorkflow = null;

    // Try to get workflow from Vapi API
    try {
      const response = await axios.get(`${VAPI_BASE_URL}/workflow/${id}`, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      });
      vapiWorkflow = response.data;
    } catch (vapiError) {
      console.warn("Failed to fetch from VAPI API, using local data:", vapiError.response?.data || vapiError.message);

      // If VAPI fails, construct workflow from local data
      vapiWorkflow = {
        id: localWorkflow.workflow_id,
        orgId: localWorkflow.org_id,
        name: localWorkflow.name,
        description: localWorkflow.description,
        nodes: typeof localWorkflow.nodes === 'string' ? JSON.parse(localWorkflow.nodes) : localWorkflow.nodes,
        edges: typeof localWorkflow.edges === 'string' ? JSON.parse(localWorkflow.edges) : localWorkflow.edges,
        model: typeof localWorkflow.model === 'string' ? JSON.parse(localWorkflow.model) : localWorkflow.model,
        transcriber: typeof localWorkflow.transcriber === 'string' ? JSON.parse(localWorkflow.transcriber) : localWorkflow.transcriber,
        voice: typeof localWorkflow.voice === 'string' ? JSON.parse(localWorkflow.voice) : localWorkflow.voice,
        globalPrompt: localWorkflow.global_prompt,
        backgroundSound: localWorkflow.background_sound,
        credentials: typeof localWorkflow.credentials === 'string' ? JSON.parse(localWorkflow.credentials) : localWorkflow.credentials,
        credentialIds: typeof localWorkflow.credential_ids === 'string' ? JSON.parse(localWorkflow.credential_ids) : localWorkflow.credential_ids,
        createdAt: localWorkflow.created_at,
        updatedAt: localWorkflow.updated_at
      };
    }

    res.status(200).json({
      success: true,
      message: "Workflow retrieved successfully",
      data: {
        ...vapiWorkflow,
        localData: localWorkflow
      }
    });
  } catch (error) {
    console.error("Error getting workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve workflow",
      error: error.message
    });
  }
};

// Create workflow
const createWorkflow = async (req, res) => {
  try {
    // Handle different token structures
    let user_id;
    if (req.user && req.user.id) {
      user_id = req.user.id;
    } else if (req.user && req.user.user && req.user.user.id) {
      user_id = req.user.user.id;
    } else {
      console.error("Authentication failed - user not found in token");
      return res.status(401).json({
        success: false,
        message: "Authentication failed - user not found in token"
      });
    }
    const workflowData = req.body;

    // Extract description for local storage, remove from Vapi data
    const { description, ...vapiWorkflowData } = workflowData;

    let vapiWorkflow = null;

    // Try to create workflow in Vapi API
    try {
      if (VAPI_SECRET_KEY) {
        const response = await axios.post(`${VAPI_BASE_URL}/workflow`, vapiWorkflowData, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`,
            "Content-Type": "application/json"
          }
        });
        vapiWorkflow = response.data;
      } else {
        console.warn("VAPI_SECRET_KEY not configured, creating local workflow only");
        throw new Error("VAPI not configured");
      }
    } catch (vapiError) {
      console.warn("Failed to create workflow in VAPI, creating local workflow:", vapiError.response?.data || vapiError.message);

      // Create a local workflow with generated ID
      vapiWorkflow = {
        id: uuidv4(),
        orgId: "local",
        name: workflowData.name,
        nodes: workflowData.nodes || [],
        edges: workflowData.edges || [],
        model: workflowData.model || null,
        transcriber: workflowData.transcriber || null,
        voice: workflowData.voice || null,
        globalPrompt: workflowData.globalPrompt || "",
        backgroundSound: workflowData.backgroundSound || "off",
        credentials: workflowData.credentials || null,
        credentialIds: workflowData.credentialIds || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    // Store workflow reference in local database
    const localWorkflowData = {
      user_id,
      workflow_id: vapiWorkflow.id,
      vapi_workflow_id: vapiWorkflow.id,
      org_id: vapiWorkflow.orgId || "synced_from_vapi",
      name: vapiWorkflow.name,
      description: description || "",
      nodes: vapiWorkflow.nodes || [],
      edges: vapiWorkflow.edges || [],
      model: vapiWorkflow.model || null,
      transcriber: vapiWorkflow.transcriber || null,
      voice: vapiWorkflow.voice || null,
      global_prompt: vapiWorkflow.globalPrompt || "",
      background_sound: vapiWorkflow.backgroundSound || "off",
      credentials: vapiWorkflow.credentials || null,
      credential_ids: vapiWorkflow.credentialIds || null,
      variables: {},
      triggers: [],
      status: "active",
      version: "1.0.0",
      tags: [],
      metadata: {
        nodeCount: vapiWorkflow.nodes?.length || 0,
        edgeCount: vapiWorkflow.edges?.length || 0,
        lastModified: new Date().toISOString()
      },
      execution_count: 0
    };

    const localWorkflowId = await WorkflowModel.createWorkflow(localWorkflowData);

    res.status(201).json({
      success: true,
      message: "Workflow created successfully",
      data: {
        ...vapiWorkflow,
        localData: { id: localWorkflowId, ...localWorkflowData }
      }
    });
  } catch (error) {
    console.error("Error creating workflow:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to create workflow",
      error: error.response?.data?.message || error.message
    });
  }
};

// Update workflow
const updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const workflowData = req.body;

    // Update workflow in Vapi API
    const response = await axios.patch(`${VAPI_BASE_URL}/workflow/${id}`, workflowData, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const vapiWorkflow = response.data;

    // Update local workflow data
    const localWorkflowData = {
      name: vapiWorkflow.name,
      description: workflowData.description || "",
      metadata: {
        nodeCount: vapiWorkflow.nodes?.length || 0,
        edgeCount: vapiWorkflow.edges?.length || 0,
        lastModified: new Date().toISOString()
      }
    };

    await WorkflowModel.updateWorkflowByWorkflowId(id, localWorkflowData);

    res.status(200).json({
      success: true,
      message: "Workflow updated successfully",
      data: vapiWorkflow
    });
  } catch (error) {
    console.error("Error updating workflow:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update workflow",
      error: error.response?.data?.message || error.message
    });
  }
};

// Delete workflow
const deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // Delete workflow from Vapi API
    await axios.delete(`${VAPI_BASE_URL}/workflow/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    // Delete local workflow data
    await WorkflowModel.deleteWorkflowByWorkflowId(id);

    res.status(200).json({
      success: true,
      message: "Workflow deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting workflow:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to delete workflow",
      error: error.response?.data?.message || error.message
    });
  }
};

// Test workflow (create call)
const testWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { phoneNumber, metadata = {} } = req.body;

    // Create call with workflow - using proper Vapi format
    const callData = {
      workflowId: id,
      phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID, // Use configured phone number ID
      customer: {
        number: phoneNumber || "+15551234567" // Customer number to call
      },
      metadata: {
        ...metadata,
        testCall: true,
        timestamp: new Date().toISOString()
      }
    };

    const call = await VapiService.createCall(callData);

    res.status(200).json({
      success: true,
      message: "Workflow test call initiated successfully",
      data: call
    });
  } catch (error) {
    console.error("Error testing workflow:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to test workflow",
      error: error.response?.data?.message || error.message
    });
  }
};

// Get workflow templates
const getWorkflowTemplates = async (req, res) => {
  try {
    const templates = [
      {
        id: "basic-greeting",
        name: "Basic Greeting Workflow",
        description: "Simple greeting workflow with information collection",
        category: "Basic",
        nodes: [
          {
            type: "conversation",
            name: "greeting",
            isStart: true,
            prompt: "Greet the user and ask how you can help them today."
          }
        ],
        edges: []
      },
      {
        id: "appointment-scheduling",
        name: "Appointment Scheduling",
        description: "Complete appointment booking workflow",
        category: "Business",
        nodes: [
          {
            type: "conversation",
            name: "greeting",
            isStart: true,
            prompt: "Greet the user and ask about scheduling an appointment."
          }
        ],
        edges: []
      },
      {
        id: "customer-support",
        name: "Customer Support",
        description: "Customer support workflow with escalation",
        category: "Support",
        nodes: [
          {
            type: "conversation",
            name: "support-greeting",
            isStart: true,
            prompt: "Greet the customer and ask about their issue."
          }
        ],
        edges: []
      }
    ];

    res.status(200).json({
      success: true,
      message: "Workflow templates retrieved successfully",
      data: templates
    });
  } catch (error) {
    console.error("Error getting workflow templates:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve workflow templates",
      error: error.message
    });
  }
};

// VAPI-specific endpoints
const createVapiWorkflow = async (req, res) => {
  try {
    const user_id = req.user.id;
    const workflowData = req.body;

    // Extract local-only properties that shouldn't be sent to VAPI
    const { description, assistantId, ...vapiWorkflowData } = workflowData;

    // Create workflow in VAPI (without local-only properties)
    const vapiWorkflow = await VapiService.createWorkflow(vapiWorkflowData);

    // Store workflow reference in local database
    const localWorkflowData = {
      user_id,
      workflow_id: vapiWorkflow.id,
      vapi_workflow_id: vapiWorkflow.id,
      org_id: vapiWorkflow.orgId || "vapi_created",
      name: vapiWorkflow.name,
      description: description || "",
      assistant_id: assistantId || null,
      nodes: vapiWorkflow.nodes || [],
      edges: vapiWorkflow.edges || [],
      model: vapiWorkflow.model || null,
      transcriber: vapiWorkflow.transcriber || null,
      voice: vapiWorkflow.voice || null,
      global_prompt: vapiWorkflow.globalPrompt || "",
      background_sound: vapiWorkflow.backgroundSound || "off",
      credentials: vapiWorkflow.credentials || null,
      credential_ids: vapiWorkflow.credentialIds || null,
      variables: {},
      triggers: [],
      status: "active",
      version: "1.0.0",
      tags: [],
      metadata: {
        nodeCount: vapiWorkflow.nodes?.length || 0,
        edgeCount: vapiWorkflow.edges?.length || 0,
        lastModified: new Date().toISOString(),
        createdVia: "vapi_api"
      }
    };

    await WorkflowModel.createWorkflow(localWorkflowData);

    res.status(201).json({
      success: true,
      message: "VAPI workflow created successfully",
      data: vapiWorkflow
    });
  } catch (error) {
    console.error("Error creating VAPI workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create VAPI workflow",
      error: error.message
    });
  }
};

const getVapiWorkflow = async (req, res) => {
  try {
    const { id } = req.params;

    // Get workflow from VAPI
    const vapiWorkflow = await VapiService.getWorkflow(id);

    // Get local workflow data
    const localWorkflow = await WorkflowModel.getWorkflowByWorkflowId(id);

    res.status(200).json({
      success: true,
      message: "VAPI workflow retrieved successfully",
      data: {
        ...vapiWorkflow,
        localData: localWorkflow
      }
    });
  } catch (error) {
    console.error("Error fetching VAPI workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch VAPI workflow",
      error: error.message
    });
  }
};

const updateVapiWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const workflowData = req.body;

    console.log('🔍 Received workflow data for update:', {
      id,
      hasName: !!workflowData.name,
      name: workflowData.name,
      keys: Object.keys(workflowData),
      dataSize: JSON.stringify(workflowData).length,
      nodeCount: workflowData.nodes?.length || 0,
      edgeCount: workflowData.edges?.length || 0
    });

    // Log the full workflow data for debugging
    console.log('📋 Full workflow data received:', JSON.stringify(workflowData, null, 2));

    // Ensure workflow has a name - get from existing workflow if not provided
    if (!workflowData.name) {
      console.log('⚠️ Workflow name missing, fetching from existing workflow...');
      try {
        const existingWorkflow = await WorkflowModel.getWorkflowByWorkflowId(id);
        if (existingWorkflow && existingWorkflow.name) {
          workflowData.name = existingWorkflow.name;
          console.log('✅ Using existing workflow name:', workflowData.name);
        } else {
          // Try to get from VAPI as fallback
          const vapiWorkflow = await VapiService.getWorkflow(id);
          if (vapiWorkflow && vapiWorkflow.name) {
            workflowData.name = vapiWorkflow.name;
            console.log('✅ Using VAPI workflow name:', workflowData.name);
          } else {
            workflowData.name = 'Unnamed Workflow';
            console.log('⚠️ Using default workflow name');
          }
        }
      } catch (fetchError) {
        console.warn('Could not fetch existing workflow name, using default:', fetchError.message);
        workflowData.name = 'Unnamed Workflow';
      }
    }

    // Extract local-only properties that shouldn't be sent to VAPI
    const { description, assistantId, ...vapiWorkflowData } = workflowData;

    let vapiWorkflow;

    try {
      // Try to update workflow in VAPI (without local-only properties)
      vapiWorkflow = await VapiService.updateWorkflow(id, vapiWorkflowData);
    } catch (updateError) {
      // If workflow not found, try to create it
      if (updateError.message && updateError.message.includes('Not Found')) {
        console.log('Workflow not found in VAPI, creating new workflow:', id);
        try {
          vapiWorkflow = await VapiService.createWorkflow({
            ...vapiWorkflowData,
            name: vapiWorkflowData.name || 'Unnamed Workflow'
          });
          console.log('Created new VAPI workflow:', vapiWorkflow.id);
        } catch (createError) {
          console.error('Failed to create workflow in VAPI:', createError);
          throw createError;
        }
      } else {
        throw updateError;
      }
    }

    // Update local workflow data
    const localWorkflowData = {
      name: vapiWorkflow.name,
      description: description || "",
      assistant_id: assistantId || null,
      metadata: {
        nodeCount: vapiWorkflow.nodes?.length || 0,
        edgeCount: vapiWorkflow.edges?.length || 0,
        lastModified: new Date().toISOString()
      }
    };

    await WorkflowModel.updateWorkflowByWorkflowId(id, localWorkflowData);

    res.status(200).json({
      success: true,
      message: "VAPI workflow updated successfully",
      data: vapiWorkflow
    });
  } catch (error) {
    console.error("Error updating VAPI workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update VAPI workflow",
      error: error.message
    });
  }
};

const deleteVapiWorkflow = async (req, res) => {
  try {
    const { id } = req.params;

    // Delete workflow from VAPI
    await VapiService.deleteWorkflow(id);

    // Delete local workflow data
    await WorkflowModel.deleteWorkflowByWorkflowId(id);

    res.status(200).json({
      success: true,
      message: "VAPI workflow deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting VAPI workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete VAPI workflow",
      error: error.message
    });
  }
};

const createVapiCall = async (req, res) => {
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

    // Import credit middleware functions
    const { isSuperAdmin, getCreditCost } = require('../../middleware/creditMiddleware');
    const CreditModel = require('../../model/CreditModel/CreditModel');
    const UsageTrackingModel = require('../../model/CreditModel/UsageTrackingModel');

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

    // Use assistantId if provided, otherwise create inline assistant
    if (assistantId) {
      callRequest.assistantId = assistantId;
    } else {
      // Create inline assistant configuration
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
    }

    console.log('📞 VAPI call request:', JSON.stringify(callRequest, null, 2));

    // Make request to VAPI
    const response = await axios.post(`${VAPI_BASE_URL}/call`, callRequest, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    console.log('✅ VAPI call created successfully:', response.data);

    // Deduct credits for call initiation (unless super admin)
    if (!(await isSuperAdmin(userId))) {
      try {
        const callInitiationCost = await getCreditCost('vapi_call', 'per_call');

        await CreditModel.deductCreditsFromUser(
          userId,
          callInitiationCost,
          'vapi_call',
          response.data.id,
          'VAPI call initiation via workflow',
          {
            call_id: response.data.id,
            customer_number: customer.number,
            assistant_id: assistantId,
            workflow_id: workflowId
          }
        );

        // Create usage tracking record
        await UsageTrackingModel.createUsageRecord({
          user_id: userId,
          operation_type: 'vapi_call',
          operation_id: response.data.id,
          credits_consumed: callInitiationCost,
          unit_cost: callInitiationCost,
          units_consumed: 1,
          unit_type: 'calls',
          operation_details: {
            call_id: response.data.id,
            customer_number: customer.number,
            assistant_id: assistantId,
            workflow_id: workflowId,
            endpoint: req.path,
            via: 'workflow'
          },
          status: 'completed'
        });

        console.log(`💰 Credits deducted: ${callInitiationCost} credits for VAPI call initiation via workflow`);
      } catch (creditError) {
        console.error('Error deducting credits:', creditError);
        // Don't fail the call if credit deduction fails, but log it
      }
    }

    res.status(200).json({
      success: true,
      data: response.data,
      message: "VAPI call created successfully"
    });

  } catch (error) {
    console.error("Error creating VAPI call:", error);

    let errorMessage = 'Failed to create VAPI call';
    let statusCode = 500;

    if (error.response) {
      console.error('VAPI API Error Response:', error.response.data);
      errorMessage = error.response.data?.message || errorMessage;
      statusCode = error.response.status;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: error.response?.data || error.message
    });
  }
};

const validateVapiWorkflow = async (req, res) => {
  try {
    const workflowData = req.body;

    // Validate workflow using VAPI service
    const validation = VapiService.validateWorkflow(workflowData);

    res.status(200).json({
      success: true,
      message: "Workflow validation completed",
      data: validation
    });
  } catch (error) {
    console.error("Error validating VAPI workflow:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate workflow",
      error: error.message
    });
  }
};

// Enhanced VAPI Call Functions
const listVapiCalls = async (req, res) => {
  try {
    const { assistantId, workflowId, limit = 50, offset = 0 } = req.query;

    let params = {
      limit: parseInt(limit),
      offset: parseInt(offset)
    };

    if (assistantId) params.assistantId = assistantId;

    const response = await axios.get(`${VAPI_BASE_URL}/call`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      },
      params
    });

    // Filter by workflowId if provided (since VAPI doesn't support this filter directly)
    let calls = response.data;
    if (workflowId && Array.isArray(calls)) {
      calls = calls.filter(call => call.metadata?.workflowId === workflowId);
    }

    res.status(200).json({
      success: true,
      data: calls,
      message: "VAPI calls retrieved successfully"
    });

  } catch (error) {
    console.error("Error listing VAPI calls:", error);
    res.status(500).json({
      success: false,
      message: "Failed to list calls",
      error: error.response?.data || error.message
    });
  }
};

const getVapiCall = async (req, res) => {
  try {
    const { callId } = req.params;

    const response = await axios.get(`${VAPI_BASE_URL}/call/${callId}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      data: response.data,
      message: "VAPI call retrieved successfully"
    });

  } catch (error) {
    console.error("Error getting VAPI call:", error);
    let statusCode = 500;
    let message = "Failed to get call details";

    if (error.response) {
      statusCode = error.response.status;
      message = error.response.data?.message || message;
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: error.response?.data || error.message
    });
  }
};

const endVapiCall = async (req, res) => {
  try {
    const { callId } = req.params;

    const response = await axios.post(`${VAPI_BASE_URL}/call/${callId}/end`, {}, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      data: response.data,
      message: "VAPI call ended successfully"
    });

  } catch (error) {
    console.error("Error ending VAPI call:", error);
    let statusCode = 500;
    let message = "Failed to end call";

    if (error.response) {
      statusCode = error.response.status;
      message = error.response.data?.message || message;
    }

    res.status(statusCode).json({
      success: false,
      message,
      error: error.response?.data || error.message
    });
  }
};

// VAPI Assistant Management
const createVapiAssistant = async (req, res) => {
  try {
    const {
      name,
      firstMessage,
      systemMessage,
      model,
      voice,
      workflowId,
      workflowName,
      workflowDescription
    } = req.body;

    console.log('🤖 Creating VAPI assistant:', { name, workflowId });

    const assistantConfig = {
      name: name || `${workflowName || 'Workflow'} Assistant`,
      firstMessage: firstMessage || `Hello! I'm your AI assistant for ${workflowName || 'this workflow'}. How can I help you today?`,
      model: model || {
        provider: "openai",
        model: "gpt-4o",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: systemMessage || `You are an advanced AI voice assistant for the "${workflowName || 'workflow'}" system.

            Key capabilities:
            - Engage in natural, conversational dialogue
            - Help users navigate through workflow processes
            - Provide clear, concise responses
            - Ask clarifying questions when needed
            - Maintain context throughout the conversation

            Guidelines:
            - Keep responses under 30 words when possible
            - Be friendly and professional
            - If you don't understand something, ask for clarification
            - Use natural speech patterns and avoid robotic responses

            Current workflow: ${workflowName || 'General workflow'}
            ${workflowDescription ? `Description: ${workflowDescription}` : ''}`
          }
        ]
      },
      voice: voice || {
        provider: "11labs",
        voiceId: "21m00Tcm4TlvDq8ikWAM",
        speed: 1.0,
        stability: 0.5,
        similarityBoost: 0.75
      },
      recordingEnabled: true,
      endCallMessage: "Thank you for using our voice assistant. Have a great day!",
      silenceTimeoutSeconds: 30,
      maxDurationSeconds: 1800, // 30 minutes
      backgroundSound: "office"
    };

    console.log('📞 Creating VAPI assistant with config:', JSON.stringify(assistantConfig, null, 2));

    const response = await axios.post(`${VAPI_BASE_URL}/assistant`, assistantConfig, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const assistant = response.data;
    console.log('✅ VAPI assistant created:', assistant.id);

    // Update workflow with assistant ID if workflowId provided
    if (workflowId) {
      try {
        const updateSuccess = await WorkflowModel.updateWorkflowAssistantId(workflowId, assistant.id);
        if (updateSuccess) {
          console.log('✅ Workflow updated with assistant ID');
        } else {
          console.warn('⚠️ Workflow not found or not updated');
        }
      } catch (updateError) {
        console.warn('⚠️ Failed to update workflow with assistant ID:', updateError);
      }
    }

    res.json({
      success: true,
      assistant: {
        id: assistant.id,
        name: assistant.name,
        firstMessage: assistant.firstMessage,
        createdAt: assistant.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error creating VAPI assistant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create assistant',
      details: error.response?.data || error.message
    });
  }
};

const getVapiAssistant = async (req, res) => {
  try {
    const { assistantId } = req.params;

    console.log('🔍 Getting VAPI assistant:', assistantId);

    const response = await axios.get(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    const assistant = response.data;

    res.json({
      success: true,
      assistant: {
        id: assistant.id,
        name: assistant.name,
        firstMessage: assistant.firstMessage,
        model: assistant.model,
        voice: assistant.voice,
        createdAt: assistant.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error getting VAPI assistant:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get assistant',
      details: error.response?.data || error.message
    });
  }
};

module.exports = {
  listWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  testWorkflow,
  getWorkflowTemplates,
  // VAPI-specific endpoints
  createVapiWorkflow,
  getVapiWorkflow,
  updateVapiWorkflow,
  deleteVapiWorkflow,
  createVapiCall,
  listVapiCalls,
  getVapiCall,
  endVapiCall,
  validateVapiWorkflow,
  // VAPI Assistant endpoints
  createVapiAssistant,
  getVapiAssistant
};
