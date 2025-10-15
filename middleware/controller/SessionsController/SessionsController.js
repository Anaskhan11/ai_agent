const axios = require("axios");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// List all sessions
const listSessions = async (req, res) => {
  try {
    const response = await axios.get(`${VAPI_BASE_URL}/session`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Sessions retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching sessions:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sessions",
      error: error.response?.data || error.message
    });
  }
};

// Get session by ID
const getSession = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${VAPI_BASE_URL}/session/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Session retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching session:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch session",
      error: error.response?.data || error.message
    });
  }
};

// Create session
const createSession = async (req, res) => {
  try {
    const {
      assistantId,
      assistant,
      assistantOverrides,
      squadId,
      squad,
      workflowId,
      workflow,
      metadata
    } = req.body;

    // Validate that at least one of assistant, squad, or workflow is provided
    if (!assistantId && !assistant && !squadId && !squad && !workflowId && !workflow) {
      return res.status(400).json({
        success: false,
        message: "Either assistantId/assistant, squadId/squad, or workflowId/workflow is required"
      });
    }

    const sessionData = {
      assistantId,
      assistant,
      assistantOverrides,
      squadId,
      squad,
      workflowId,
      workflow,
      metadata
    };

    const response = await axios.post(
      `${VAPI_BASE_URL}/session`,
      sessionData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Session created successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error creating session:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to create session",
      error: error.response?.data || error.message
    });
  }
};

// Update session
const updateSession = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const response = await axios.patch(
      `${VAPI_BASE_URL}/session/${id}`,
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
      message: "Session updated successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error updating session:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to update session",
      error: error.response?.data || error.message
    });
  }
};

// Delete session
const deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    await axios.delete(`${VAPI_BASE_URL}/session/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Session deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting session:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete session",
      error: error.response?.data || error.message
    });
  }
};

// Get session messages
const getSessionMessages = async (req, res) => {
  try {
    const { id } = req.params;

    // This might not be a direct VAPI endpoint, so we'll simulate it
    const mockMessages = [
      {
        id: "msg_1",
        role: "assistant",
        content: "Hello! How can I help you today?",
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: "text"
      },
      {
        id: "msg_2",
        role: "user",
        content: "I need help with my account",
        timestamp: new Date(Date.now() - 240000).toISOString(),
        type: "text"
      },
      {
        id: "msg_3",
        role: "assistant",
        content: "I'd be happy to help you with your account. What specific issue are you experiencing?",
        timestamp: new Date(Date.now() - 180000).toISOString(),
        type: "text"
      }
    ];

    res.status(200).json({
      success: true,
      message: "Session messages retrieved successfully",
      data: {
        sessionId: id,
        messages: mockMessages,
        totalMessages: mockMessages.length
      }
    });
  } catch (error) {
    console.error("Error fetching session messages:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch session messages",
      error: error.message
    });
  }
};

// Get session statistics
const getSessionStats = async (req, res) => {
  try {
    const mockStats = {
      totalSessions: 1250,
      activeSessions: 45,
      averageSessionDuration: 420, // seconds
      totalMessages: 15600,
      averageMessagesPerSession: 12.5,
      topAssistants: [
        { assistantId: "asst_1", name: "Customer Support", sessions: 450 },
        { assistantId: "asst_2", name: "Sales Assistant", sessions: 320 },
        { assistantId: "asst_3", name: "Technical Support", sessions: 280 }
      ],
      sessionsByStatus: {
        active: 45,
        completed: 1180,
        failed: 25
      },
      averageResponseTime: 850 // milliseconds
    };

    res.status(200).json({
      success: true,
      message: "Session statistics retrieved successfully",
      data: mockStats
    });
  } catch (error) {
    console.error("Error fetching session statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch session statistics",
      error: error.message
    });
  }
};

module.exports = {
  listSessions,
  getSession,
  createSession,
  updateSession,
  deleteSession,
  getSessionMessages,
  getSessionStats
};
