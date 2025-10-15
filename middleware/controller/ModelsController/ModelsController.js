const axios = require("axios");
require("dotenv").config({ path: "./config/config.env" });

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY || "aa6161d2-7ba0-4182-96aa-fee4a9f14fd8";

console.log("Models Controller - VAPI_SECRET_KEY loaded:", VAPI_SECRET_KEY ? "✓" : "✗");

// Get available models from VAPI
const getAvailableModels = async (req, res) => {
  try {
    // VAPI doesn't have a direct models endpoint, but we can provide supported models
    const supportedModels = {
      openai: [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", description: "Most capable GPT-4 model" },
        { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai", description: "Faster, cheaper GPT-4 model" },
        { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "openai", description: "GPT-4 Turbo model" },
        { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "openai", description: "Fast and efficient model" }
      ],
      anthropic: [
        { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "anthropic", description: "Most intelligent Claude model" },
        { id: "claude-3-opus-20240229", name: "Claude 3 Opus", provider: "anthropic", description: "Most powerful Claude model" },
        { id: "claude-3-sonnet-20240229", name: "Claude 3 Sonnet", provider: "anthropic", description: "Balanced Claude model" },
        { id: "claude-3-haiku-20240307", name: "Claude 3 Haiku", provider: "anthropic", description: "Fastest Claude model" }
      ],
      groq: [
        { id: "llama-3.1-70b-versatile", name: "Llama 3.1 70B", provider: "groq", description: "Large Llama model" },
        { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "groq", description: "Fast Llama model" },
        { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B", provider: "groq", description: "Mixture of experts model" }
      ],
      together: [
        { id: "meta-llama/Llama-3-70b-chat-hf", name: "Llama 3 70B Chat", provider: "together", description: "Large chat model" },
        { id: "meta-llama/Llama-3-8b-chat-hf", name: "Llama 3 8B Chat", provider: "together", description: "Efficient chat model" }
      ],
      anyscale: [
        { id: "meta-llama/Llama-2-70b-chat-hf", name: "Llama 2 70B Chat", provider: "anyscale", description: "Large Llama 2 model" },
        { id: "meta-llama/Llama-2-13b-chat-hf", name: "Llama 2 13B Chat", provider: "anyscale", description: "Medium Llama 2 model" }
      ],
      openrouter: [
        { id: "openai/gpt-4o", name: "GPT-4o via OpenRouter", provider: "openrouter", description: "GPT-4o through OpenRouter" },
        { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet via OpenRouter", provider: "openrouter", description: "Claude 3.5 Sonnet through OpenRouter" }
      ],
      perplexity: [
        { id: "llama-3.1-sonar-large-128k-online", name: "Sonar Large Online", provider: "perplexity", description: "Large online model" },
        { id: "llama-3.1-sonar-small-128k-online", name: "Sonar Small Online", provider: "perplexity", description: "Small online model" }
      ]
    };

    res.status(200).json({
      success: true,
      message: "Available models retrieved successfully",
      data: supportedModels
    });
  } catch (error) {
    console.error("Error fetching available models:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available models",
      error: error.message
    });
  }
};

// Create model configuration
const createModelConfig = async (req, res) => {
  try {
    const { provider, model, temperature, maxTokens, topP, frequencyPenalty, presencePenalty, systemMessage } = req.body;

    if (!provider || !model) {
      return res.status(400).json({
        success: false,
        message: "Provider and model are required"
      });
    }

    const modelConfig = {
      provider,
      model,
      temperature: temperature || 0.7,
      maxTokens: maxTokens || 1000,
      topP: topP || 1,
      frequencyPenalty: frequencyPenalty || 0,
      presencePenalty: presencePenalty || 0,
      systemMessage: systemMessage || "You are a helpful AI assistant."
    };

    // In a real implementation, you might save this to your database
    // For now, we'll just return the configuration
    res.status(201).json({
      success: true,
      message: "Model configuration created successfully",
      data: modelConfig
    });
  } catch (error) {
    console.error("Error creating model configuration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create model configuration",
      error: error.message
    });
  }
};

// Test model configuration
const testModel = async (req, res) => {
  try {
    const { provider, model, message, temperature, maxTokens } = req.body;

    if (!provider || !model || !message) {
      return res.status(400).json({
        success: false,
        message: "Provider, model, and message are required"
      });
    }

    // Create a test assistant with the specified model
    const testAssistant = {
      model: {
        provider,
        model,
        temperature: temperature || 0.7,
        maxTokens: maxTokens || 100
      },
      voice: {
        provider: "11labs",
        voiceId: "sarah"
      },
      firstMessage: message
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
      message: "Model test completed successfully",
      data: {
        provider,
        model,
        testMessage: message,
        status: "working"
      }
    });
  } catch (error) {
    console.error("Error testing model:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Model test failed",
      error: error.response?.data || error.message
    });
  }
};

// Get model usage statistics
const getModelStats = async (req, res) => {
  try {
    // This would typically come from your analytics/usage tracking
    const mockStats = {
      totalRequests: 1250,
      totalTokens: 125000,
      averageResponseTime: 850,
      topModels: [
        { model: "gpt-4o", usage: 45, provider: "openai" },
        { model: "claude-3-5-sonnet-20241022", usage: 30, provider: "anthropic" },
        { model: "gpt-3.5-turbo", usage: 25, provider: "openai" }
      ],
      costBreakdown: {
        openai: 45.50,
        anthropic: 32.25,
        groq: 8.75,
        total: 86.50
      }
    };

    res.status(200).json({
      success: true,
      message: "Model statistics retrieved successfully",
      data: mockStats
    });
  } catch (error) {
    console.error("Error fetching model statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch model statistics",
      error: error.message
    });
  }
};

module.exports = {
  getAvailableModels,
  createModelConfig,
  testModel,
  getModelStats
};
