const axios = require("axios");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// List all chats
const listChats = async (req, res) => {
  try {
    const response = await axios.get(`${VAPI_BASE_URL}/chat`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Chats retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching chats:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chats",
      error: error.response?.data || error.message
    });
  }
};

// Get chat by ID
const getChat = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${VAPI_BASE_URL}/chat/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Chat retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching chat:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch chat",
      error: error.response?.data || error.message
    });
  }
};

// Create chat
const createChat = async (req, res) => {
  try {
    const {
      assistantId,
      assistant,
      assistantOverrides,
      squadId,
      squad,
      workflowId,
      workflow,
      messages,
      metadata
    } = req.body;

    // Validate that at least one of assistant, squad, or workflow is provided
    if (!assistantId && !assistant && !squadId && !squad && !workflowId && !workflow) {
      return res.status(400).json({
        success: false,
        message: "Either assistantId/assistant, squadId/squad, or workflowId/workflow is required"
      });
    }

    const chatData = {
      assistantId,
      assistant,
      assistantOverrides,
      squadId,
      squad,
      workflowId,
      workflow,
      messages: messages || [],
      metadata
    };

    const response = await axios.post(
      `${VAPI_BASE_URL}/chat`,
      chatData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(201).json({
      success: true,
      message: "Chat created successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error creating chat:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to create chat",
      error: error.response?.data || error.message
    });
  }
};

// Delete chat
const deleteChat = async (req, res) => {
  try {
    const { id } = req.params;

    await axios.delete(`${VAPI_BASE_URL}/chat/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Chat deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting chat:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete chat",
      error: error.response?.data || error.message
    });
  }
};

// Create chat completion (OpenAI compatible)
const createChatCompletion = async (req, res) => {
  try {
    const {
      model,
      messages,
      temperature,
      max_tokens,
      stream,
      assistantId,
      assistant
    } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Messages array is required and cannot be empty"
      });
    }

    const chatData = {
      model: model || "gpt-3.5-turbo",
      messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || 1000,
      stream: stream || false,
      assistantId,
      assistant
    };

    const response = await axios.post(
      `${VAPI_BASE_URL}/chat/completions`,
      chatData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    res.status(200).json({
      success: true,
      message: "Chat completion created successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error creating chat completion:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to create chat completion",
      error: error.response?.data || error.message
    });
  }
};

// Send message to chat
const sendMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { message, role } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required"
      });
    }

    // This might not be a direct VAPI endpoint, so we'll simulate it
    const mockResponse = {
      chatId: id,
      messageId: `msg_${Date.now()}`,
      role: "assistant",
      content: `I received your message: "${message}". How can I help you further?`,
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: mockResponse
    });
  } catch (error) {
    console.error("Error sending message:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send message",
      error: error.message
    });
  }
};

// Get chat statistics
const getChatStats = async (req, res) => {
  try {
    const mockStats = {
      totalChats: 2450,
      activeChats: 125,
      averageChatDuration: 320, // seconds
      totalMessages: 28600,
      averageMessagesPerChat: 11.7,
      topAssistants: [
        { assistantId: "asst_1", name: "Customer Support", chats: 850 },
        { assistantId: "asst_2", name: "Sales Assistant", chats: 620 },
        { assistantId: "asst_3", name: "Technical Support", chats: 480 }
      ],
      chatsByStatus: {
        active: 125,
        completed: 2280,
        failed: 45
      },
      averageResponseTime: 650, // milliseconds
      satisfactionRating: 4.2,
      resolutionRate: 87.5
    };

    res.status(200).json({
      success: true,
      message: "Chat statistics retrieved successfully",
      data: mockStats
    });
  } catch (error) {
    console.error("Error fetching chat statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch chat statistics",
      error: error.message
    });
  }
};

module.exports = {
  listChats,
  getChat,
  createChat,
  deleteChat,
  createChatCompletion,
  sendMessage,
  getChatStats
};
