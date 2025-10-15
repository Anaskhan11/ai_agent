const axios = require("axios");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// List all tools
const listTools = async (req, res) => {
  try {
    const response = await axios.get(`${VAPI_BASE_URL}/tool`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Tools retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching tools:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tools",
      error: error.response?.data || error.message
    });
  }
};

// Get tool by ID
const getTool = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${VAPI_BASE_URL}/tool/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Tool retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching tool:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch tool",
      error: error.response?.data || error.message
    });
  }
};

// Create tool
const createTool = async (req, res) => {
  try {
    const {
      type,
      name,
      description,
      function: functionDef,
      server,
      dtmf,
      endCall,
      transferCall,
      voicemail
    } = req.body;

    if (!type || !name) {
      return res.status(400).json({
        success: false,
        message: "Type and name are required"
      });
    }

    let toolData = {
      type,
      name,
      description
    };

    // Add type-specific properties
    switch (type) {
      case "function":
        if (!functionDef) {
          return res.status(400).json({
            success: false,
            message: "Function definition is required for function tools"
          });
        }
        toolData.function = functionDef;
        if (server) toolData.server = server;
        break;
      
      case "dtmf":
        if (!dtmf) {
          return res.status(400).json({
            success: false,
            message: "DTMF configuration is required for DTMF tools"
          });
        }
        toolData.dtmf = dtmf;
        break;
      
      case "endCall":
        if (endCall) toolData.endCall = endCall;
        break;
      
      case "transferCall":
        if (!transferCall) {
          return res.status(400).json({
            success: false,
            message: "Transfer call configuration is required for transfer tools"
          });
        }
        toolData.transferCall = transferCall;
        break;
      
      case "voicemail":
        if (voicemail) toolData.voicemail = voicemail;
        break;
    }

    const response = await axios.post(
      `${VAPI_BASE_URL}/tool`,
      toolData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Tool created successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error creating tool:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to create tool",
      error: error.response?.data || error.message
    });
  }
};

// Update tool
const updateTool = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const response = await axios.patch(
      `${VAPI_BASE_URL}/tool/${id}`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(200).json({
      success: true,
      message: "Tool updated successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error updating tool:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to update tool",
      error: error.response?.data || error.message
    });
  }
};

// Delete tool
const deleteTool = async (req, res) => {
  try {
    const { id } = req.params;

    await axios.delete(`${VAPI_BASE_URL}/tool/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Tool deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting tool:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete tool",
      error: error.response?.data || error.message
    });
  }
};

// Get tool templates
const getToolTemplates = async (req, res) => {
  try {
    const templates = {
      function: {
        type: "function",
        name: "Example Function Tool",
        description: "An example function tool",
        function: {
          name: "get_weather",
          description: "Get current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA"
              }
            },
            required: ["location"]
          }
        },
        server: {
          url: "https://your-server.com/webhook",
          secret: "your-webhook-secret"
        }
      },
      dtmf: {
        type: "dtmf",
        name: "DTMF Tool",
        description: "Collect DTMF input from user",
        dtmf: {
          function: {
            name: "collect_digits",
            description: "Collect digits from user",
            parameters: {
              type: "object",
              properties: {
                digits: {
                  type: "string",
                  description: "The digits entered by user"
                }
              }
            }
          }
        }
      },
      endCall: {
        type: "endCall",
        name: "End Call Tool",
        description: "End the current call"
      },
      transferCall: {
        type: "transferCall",
        name: "Transfer Call Tool",
        description: "Transfer call to another number",
        transferCall: {
          destinations: [
            {
              type: "number",
              number: "+1234567890",
              description: "Support line"
            }
          ]
        }
      },
      voicemail: {
        type: "voicemail",
        name: "Voicemail Tool",
        description: "Handle voicemail detection"
      }
    };

    res.status(200).json({
      success: true,
      message: "Tool templates retrieved successfully",
      data: templates
    });
  } catch (error) {
    console.error("Error fetching tool templates:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch tool templates",
      error: error.message
    });
  }
};

module.exports = {
  listTools,
  getTool,
  createTool,
  updateTool,
  deleteTool,
  getToolTemplates
};
