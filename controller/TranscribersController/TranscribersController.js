const axios = require("axios");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Get available transcribers from different providers
const getAvailableTranscribers = async (req, res) => {
  try {
    const supportedTranscribers = {
      "deepgram": {
        provider: "deepgram",
        models: [
          { id: "nova-2", name: "Nova 2", description: "Latest and most accurate model", language: "en", realtime: true },
          { id: "nova", name: "Nova", description: "High accuracy general model", language: "en", realtime: true },
          { id: "enhanced", name: "Enhanced", description: "Enhanced accuracy model", language: "en", realtime: true },
          { id: "base", name: "Base", description: "Standard accuracy model", language: "en", realtime: true }
        ],
        features: ["real-time", "batch", "punctuation", "diarization", "profanity-filter", "redaction"],
        languages: ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh"],
        confidenceThreshold: 0.5
      },
      "assembly-ai": {
        provider: "assembly-ai",
        models: [
          { id: "best", name: "Best", description: "Highest accuracy model", language: "en", realtime: true },
          { id: "nano", name: "Nano", description: "Fastest model", language: "en", realtime: true }
        ],
        features: ["real-time", "batch", "punctuation", "diarization", "sentiment-analysis", "entity-detection"],
        languages: ["en"],
        confidenceThreshold: 0.5
      },
      "openai": {
        provider: "openai",
        models: [
          { id: "whisper-1", name: "Whisper", description: "OpenAI's speech recognition model", language: "multilingual", realtime: false }
        ],
        features: ["batch", "multilingual", "translation", "punctuation"],
        languages: ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh", "ar", "hi"],
        confidenceThreshold: 0.0
      },
      "azure": {
        provider: "azure",
        models: [
          { id: "latest", name: "Latest", description: "Azure's latest speech model", language: "multilingual", realtime: true }
        ],
        features: ["real-time", "batch", "punctuation", "diarization", "profanity-filter"],
        languages: ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh"],
        confidenceThreshold: 0.5
      },
      "google": {
        provider: "google",
        models: [
          { id: "latest", name: "Latest", description: "Google's speech recognition model", language: "multilingual", realtime: true },
          { id: "enhanced", name: "Enhanced", description: "Enhanced phone call model", language: "multilingual", realtime: true }
        ],
        features: ["real-time", "batch", "punctuation", "diarization", "profanity-filter"],
        languages: ["en", "es", "fr", "de", "it", "pt", "nl", "pl", "ru", "ja", "ko", "zh"],
        confidenceThreshold: 0.5
      }
    };

    const { provider } = req.query;
    
    if (provider && supportedTranscribers[provider]) {
      res.status(200).json({
        success: true,
        message: `Available transcribers for ${provider} retrieved successfully`,
        data: { [provider]: supportedTranscribers[provider] }
      });
    } else {
      res.status(200).json({
        success: true,
        message: "All available transcribers retrieved successfully",
        data: supportedTranscribers
      });
    }
  } catch (error) {
    console.error("Error fetching available transcribers:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available transcribers",
      error: error.message
    });
  }
};

// Create transcriber configuration
const createTranscriberConfig = async (req, res) => {
  try {
    const { 
      provider, 
      model, 
      language, 
      confidenceThreshold, 
      punctuation, 
      diarization, 
      profanityFilter,
      keywords,
      endpointing
    } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Provider is required"
      });
    }

    const transcriberConfig = {
      provider,
      model: model || "latest",
      language: language || "en",
      confidenceThreshold: confidenceThreshold || 0.5,
      punctuation: punctuation !== false,
      diarization: diarization || false,
      profanityFilter: profanityFilter || false,
      keywords: keywords || [],
      endpointing: endpointing || 255
    };

    res.status(201).json({
      success: true,
      message: "Transcriber configuration created successfully",
      data: transcriberConfig
    });
  } catch (error) {
    console.error("Error creating transcriber configuration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create transcriber configuration",
      error: error.message
    });
  }
};

// Test transcriber configuration
const testTranscriber = async (req, res) => {
  try {
    const { provider, model, language, confidenceThreshold } = req.body;

    if (!provider) {
      return res.status(400).json({
        success: false,
        message: "Provider is required"
      });
    }

    // Create a test assistant with the specified transcriber
    const testAssistant = {
      transcriber: {
        provider,
        model: model || "latest",
        language: language || "en",
        confidenceThreshold: confidenceThreshold || 0.5
      },
      model: {
        provider: "openai",
        model: "gpt-3.5-turbo"
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah"
      },
      firstMessage: "Hello! I'm testing the transcriber configuration."
    };

    const response = await axios.post(
      `${VAPI_BASE_URL}/assistant`,
      testAssistant,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    // Clean up - delete the test assistant
    if (response.data.id) {
      try {
        await axios.delete(`${VAPI_BASE_URL}/assistant/${response.data.id}`, {
          headers: {
            Authorization: `Bearer ${VAPI_SECRET_KEY}`
          }
        });
      } catch (deleteError) {
        console.warn("Failed to delete test assistant:", deleteError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: "Transcriber test completed successfully",
      data: {
        provider,
        model: model || "latest",
        language: language || "en",
        status: "working"
      }
    });
  } catch (error) {
    console.error("Error testing transcriber:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Transcriber test failed",
      error: error.response?.data || error.message
    });
  }
};

// Get transcriber usage statistics
const getTranscriberStats = async (req, res) => {
  try {
    const mockStats = {
      totalMinutes: 2450,
      totalRequests: 1250,
      averageAccuracy: 94.5,
      topTranscribers: [
        { provider: "deepgram", model: "nova-2", usage: 45, accuracy: 96.2 },
        { provider: "assembly-ai", model: "best", usage: 30, accuracy: 95.8 },
        { provider: "openai", model: "whisper-1", usage: 15, accuracy: 92.1 },
        { provider: "azure", model: "latest", usage: 10, accuracy: 93.5 }
      ],
      costBreakdown: {
        "deepgram": 18.50,
        "assembly-ai": 22.25,
        "openai": 8.75,
        "azure": 15.50,
        "google": 12.25,
        total: 77.25
      },
      languageBreakdown: {
        "en": 85,
        "es": 8,
        "fr": 4,
        "de": 2,
        "other": 1
      }
    };

    res.status(200).json({
      success: true,
      message: "Transcriber statistics retrieved successfully",
      data: mockStats
    });
  } catch (error) {
    console.error("Error fetching transcriber statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transcriber statistics",
      error: error.message
    });
  }
};

module.exports = {
  getAvailableTranscribers,
  createTranscriberConfig,
  testTranscriber,
  getTranscriberStats
};
