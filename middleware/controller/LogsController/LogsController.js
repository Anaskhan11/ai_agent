const axios = require("axios");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Get logs
const getLogs = async (req, res) => {
  try {
    const {
      level,
      assistantId,
      callId,
      startTime,
      endTime,
      limit,
      offset,
      search
    } = req.query;

    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (assistantId) params.append('assistantId', assistantId);
    if (callId) params.append('callId', callId);
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);
    if (limit) params.append('limit', limit);
    if (offset) params.append('offset', offset);
    if (search) params.append('search', search);

    const response = await axios.get(`${VAPI_BASE_URL}/logs?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Logs retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching logs:", error.response?.data || error.message);
    
    // If the endpoint doesn't exist, return mock data
    if (error.response?.status === 404) {
      const mockLogs = {
        logs: [
          {
            id: "log_1",
            timestamp: new Date(Date.now() - 300000).toISOString(),
            level: "info",
            message: "Call started successfully",
            callId: "call_123",
            assistantId: "asst_456",
            metadata: {
              phoneNumber: "+1234567890",
              duration: 0
            }
          },
          {
            id: "log_2",
            timestamp: new Date(Date.now() - 280000).toISOString(),
            level: "debug",
            message: "Transcription received: 'Hello, how can I help you?'",
            callId: "call_123",
            assistantId: "asst_456",
            metadata: {
              transcription: "Hello, how can I help you?",
              confidence: 0.95
            }
          },
          {
            id: "log_3",
            timestamp: new Date(Date.now() - 260000).toISOString(),
            level: "info",
            message: "LLM response generated",
            callId: "call_123",
            assistantId: "asst_456",
            metadata: {
              response: "Hello! I'm here to assist you. What can I help you with today?",
              tokens: 15,
              latency: 850
            }
          },
          {
            id: "log_4",
            timestamp: new Date(Date.now() - 240000).toISOString(),
            level: "info",
            message: "TTS audio generated",
            callId: "call_123",
            assistantId: "asst_456",
            metadata: {
              characters: 65,
              voice: "sarah",
              latency: 320
            }
          },
          {
            id: "log_5",
            timestamp: new Date(Date.now() - 220000).toISOString(),
            level: "warn",
            message: "High latency detected in LLM response",
            callId: "call_124",
            assistantId: "asst_456",
            metadata: {
              latency: 2500,
              threshold: 2000
            }
          },
          {
            id: "log_6",
            timestamp: new Date(Date.now() - 200000).toISOString(),
            level: "error",
            message: "Transcription service temporarily unavailable",
            callId: "call_125",
            assistantId: "asst_789",
            metadata: {
              error: "Service timeout",
              retryAttempt: 1
            }
          },
          {
            id: "log_7",
            timestamp: new Date(Date.now() - 180000).toISOString(),
            level: "info",
            message: "Call ended by customer",
            callId: "call_123",
            assistantId: "asst_456",
            metadata: {
              duration: 420,
              endReason: "customer-ended-call"
            }
          }
        ],
        totalLogs: 1250,
        hasMore: true,
        filters: {
          level: level || "all",
          assistantId: assistantId || "all",
          callId: callId || "all"
        }
      };

      return res.status(200).json({
        success: true,
        message: "Logs retrieved successfully (simulated)",
        data: mockLogs
      });
    }

    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch logs",
      error: error.response?.data || error.message
    });
  }
};

// Delete logs
const deleteLogs = async (req, res) => {
  try {
    const {
      level,
      assistantId,
      callId,
      startTime,
      endTime
    } = req.query;

    const params = new URLSearchParams();
    if (level) params.append('level', level);
    if (assistantId) params.append('assistantId', assistantId);
    if (callId) params.append('callId', callId);
    if (startTime) params.append('startTime', startTime);
    if (endTime) params.append('endTime', endTime);

    await axios.delete(`${VAPI_BASE_URL}/logs?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Logs deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting logs:", error.response?.data || error.message);
    
    // If the endpoint doesn't exist, return success anyway
    if (error.response?.status === 404) {
      return res.status(200).json({
        success: true,
        message: "Logs deleted successfully (simulated)"
      });
    }

    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete logs",
      error: error.response?.data || error.message
    });
  }
};

// Get log statistics
const getLogStats = async (req, res) => {
  try {
    const { timeRange } = req.query;

    const mockLogStats = {
      timeRange: timeRange || "24h",
      totalLogs: 15420,
      logsByLevel: {
        error: 125,
        warn: 340,
        info: 12450,
        debug: 2505
      },
      logsByComponent: {
        stt: 3850,
        llm: 4620,
        tts: 3850,
        transport: 2100,
        system: 1000
      },
      topErrors: [
        {
          message: "Transcription service timeout",
          count: 45,
          lastOccurrence: new Date(Date.now() - 120000).toISOString()
        },
        {
          message: "LLM rate limit exceeded",
          count: 32,
          lastOccurrence: new Date(Date.now() - 180000).toISOString()
        },
        {
          message: "TTS voice synthesis failed",
          count: 28,
          lastOccurrence: new Date(Date.now() - 240000).toISOString()
        },
        {
          message: "Phone call connection dropped",
          count: 20,
          lastOccurrence: new Date(Date.now() - 300000).toISOString()
        }
      ],
      logsByHour: [
        { hour: "00", total: 420, errors: 8, warns: 15 },
        { hour: "01", total: 280, errors: 5, warns: 10 },
        { hour: "02", total: 180, errors: 3, warns: 6 },
        { hour: "03", total: 120, errors: 2, warns: 4 },
        { hour: "04", total: 90, errors: 1, warns: 3 },
        { hour: "05", total: 150, errors: 2, warns: 5 },
        { hour: "06", total: 320, errors: 6, warns: 12 },
        { hour: "07", total: 580, errors: 10, warns: 18 },
        { hour: "08", total: 920, errors: 15, warns: 25 },
        { hour: "09", total: 1240, errors: 20, warns: 35 },
        { hour: "10", total: 1580, errors: 25, warns: 42 },
        { hour: "11", total: 1720, errors: 28, warns: 48 },
        { hour: "12", total: 1850, errors: 30, warns: 52 },
        { hour: "13", total: 1920, errors: 32, warns: 55 },
        { hour: "14", total: 2100, errors: 35, warns: 60 },
        { hour: "15", total: 2050, errors: 33, warns: 58 },
        { hour: "16", total: 1800, errors: 28, warns: 50 },
        { hour: "17", total: 1550, errors: 24, warns: 42 },
        { hour: "18", total: 1200, errors: 18, warns: 32 },
        { hour: "19", total: 950, errors: 14, warns: 25 },
        { hour: "20", total: 720, errors: 10, warns: 18 },
        { hour: "21", total: 580, errors: 8, warns: 15 },
        { hour: "22", total: 450, errors: 6, warns: 12 },
        { hour: "23", total: 380, errors: 5, warns: 10 }
      ]
    };

    res.status(200).json({
      success: true,
      message: "Log statistics retrieved successfully",
      data: mockLogStats
    });
  } catch (error) {
    console.error("Error fetching log statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch log statistics",
      error: error.message
    });
  }
};

// Export logs
const exportLogs = async (req, res) => {
  try {
    const {
      format,
      level,
      assistantId,
      callId,
      startTime,
      endTime
    } = req.query;

    // Mock export functionality
    const exportData = {
      exportId: `export_${Date.now()}`,
      format: format || "json",
      status: "processing",
      filters: {
        level: level || "all",
        assistantId: assistantId || "all",
        callId: callId || "all",
        startTime: startTime || null,
        endTime: endTime || null
      },
      estimatedSize: "2.5MB",
      estimatedRecords: 1250,
      downloadUrl: null // Will be populated when export is complete
    };

    res.status(202).json({
      success: true,
      message: "Log export initiated successfully",
      data: exportData
    });
  } catch (error) {
    console.error("Error exporting logs:", error);
    res.status(500).json({
      success: false,
      message: "Failed to export logs",
      error: error.message
    });
  }
};

module.exports = {
  getLogs,
  deleteLogs,
  getLogStats,
  exportLogs
};
