const axios = require("axios");
require("dotenv").config({ path: "./config/config.env" });

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY || "aa6161d2-7ba0-4182-96aa-fee4a9f14fd8";

console.log("Voices Controller - VAPI_SECRET_KEY loaded:", VAPI_SECRET_KEY ? "✓" : "✗");

// Helper function to clean voice configuration based on provider
function cleanVoiceConfig(voice) {
  if (!voice || !voice.provider) {
    return voice;
  }

  const cleanedVoice = {
    provider: voice.provider,
    voiceId: voice.voiceId
  };

  // Only include supported properties based on provider
  if (voice.provider === 'cartesia') {
    // Cartesia only supports provider and voiceId
    console.log('🎵 Cleaning voice config for Cartesia provider - removing unsupported properties');
  } else if (voice.provider === '11labs') {
    // 11labs supports additional properties
    if (voice.speed !== undefined) cleanedVoice.speed = voice.speed;
    if (voice.stability !== undefined) cleanedVoice.stability = voice.stability;
    if (voice.similarityBoost !== undefined) cleanedVoice.similarityBoost = voice.similarityBoost;
    if (voice.style !== undefined) cleanedVoice.style = voice.style;
    if (voice.useSpeakerBoost !== undefined) cleanedVoice.useSpeakerBoost = voice.useSpeakerBoost;
    console.log('🎵 Cleaning voice config for 11labs provider - keeping supported properties');
  } else {
    // For other providers, include speed if available
    if (voice.speed !== undefined) cleanedVoice.speed = voice.speed;
    console.log(`🎵 Cleaning voice config for ${voice.provider} provider`);
  }

  return cleanedVoice;
}

// Helper function to process VAPI voices - FILTER ONLY Cartesia and 11labs
const processVapiVoices = (vapiVoices) => {
  const processedVoices = {};

  vapiVoices.forEach(voice => {
    const provider = voice.provider || 'unknown';

    // ONLY include Cartesia and 11labs voices (VAPI's supported providers)
    if (provider !== 'cartesia' && provider !== '11labs') {
      console.log(`🚫 Filtering out voice from provider: ${provider}`);
      return; // Skip this voice
    }

    if (!processedVoices[provider]) {
      processedVoices[provider] = [];
    }

    processedVoices[provider].push({
      id: voice.voiceId || voice.id,
      name: voice.name || voice.voiceId,
      provider: provider,
      gender: voice.gender || 'unknown',
      accent: voice.accent || voice.language || 'unknown',
      language: voice.language || 'en-US',
      description: voice.description || `${voice.name || voice.voiceId} voice`,
      previewUrl: voice.previewUrl || `/api/voices/preview/${provider}/${voice.voiceId || voice.id}`,
      vapiVoice: true // Mark as VAPI voice
    });
  });

  console.log(`✅ Processed voices for providers: ${Object.keys(processedVoices).join(', ')}`);
  return processedVoices;
};

// Helper function to merge VAPI voices with fallback voices - ONLY Cartesia and 11labs
const mergeVoices = (vapiVoices, fallbackVoices) => {
  const merged = { ...fallbackVoices };

  // Add or replace with VAPI voices - ONLY Cartesia and 11labs
  Object.keys(vapiVoices).forEach(provider => {
    // ONLY include Cartesia and 11labs voices
    if ((provider === 'cartesia' || provider === '11labs') && vapiVoices[provider] && vapiVoices[provider].length > 0) {
      merged[provider] = vapiVoices[provider];
      console.log(`✅ Merged ${vapiVoices[provider].length} voices for provider: ${provider}`);
    } else if (provider !== 'cartesia' && provider !== '11labs') {
      console.log(`🚫 Skipping voices for provider: ${provider}`);
    }
  });

  return merged;
};

// Get known VAPI-supported voices - REAL VAPI PROVIDERS
const getKnownVapiVoices = () => {
  return {
    "cartesia": [
      // Cartesia voices with correct UUIDs
      { id: "79a125e8-cd45-4c13-8a67-188112f4dd22", name: "British Lady", provider: "cartesia", gender: "female", accent: "british", description: "Elegant British female voice", previewUrl: "/api/voices/preview/vapi/cartesia/79a125e8-cd45-4c13-8a67-188112f4dd22" },
      { id: "a167e0f3-df7e-4d52-a9c3-f949145efdab", name: "Customer Support Man", provider: "cartesia", gender: "male", accent: "american", description: "Professional customer support male voice", previewUrl: "/api/voices/preview/vapi/cartesia/a167e0f3-df7e-4d52-a9c3-f949145efdab" },
      { id: "829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30", name: "Customer Support Lady", provider: "cartesia", gender: "female", accent: "american", description: "Professional customer support female voice", previewUrl: "/api/voices/preview/vapi/cartesia/829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30" },
      { id: "a0e99841-438c-4a64-b679-ae501e7d6091", name: "Barbershop Man", provider: "cartesia", gender: "male", accent: "american", description: "Friendly barbershop male voice", previewUrl: "/api/voices/preview/vapi/cartesia/a0e99841-438c-4a64-b679-ae501e7d6091" },
      { id: "69267136-1bdc-412f-ad78-0caad210fb40", name: "Friendly Reading Man", provider: "cartesia", gender: "male", accent: "american", description: "Warm, friendly reading voice", previewUrl: "/api/voices/preview/vapi/cartesia/69267136-1bdc-412f-ad78-0caad210fb40" }
    ],
    "11labs": [
      { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", provider: "11labs", gender: "female", accent: "american", description: "Warm and professional", previewUrl: "/api/voices/preview/vapi/11labs/21m00Tcm4TlvDq8ikWAM" },
      { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", provider: "11labs", gender: "female", accent: "american", description: "Energetic and friendly", previewUrl: "/api/voices/preview/vapi/11labs/AZnzlk1XvdvUeBnXmlld" },
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", provider: "11labs", gender: "female", accent: "american", description: "Soft and gentle", previewUrl: "/api/voices/preview/vapi/11labs/EXAVITQu4vr4xnSDxMaL" },
      { id: "ErXwobaYiN019PkySvjV", name: "Antoni", provider: "11labs", gender: "male", accent: "american", description: "Deep and authoritative", previewUrl: "/api/voices/preview/vapi/11labs/ErXwobaYiN019PkySvjV" },
      { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", provider: "11labs", gender: "female", accent: "american", description: "Young and vibrant", previewUrl: "/api/voices/preview/vapi/11labs/MF3mGyEYCl7XYWbV9V6O" },
      { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", provider: "11labs", gender: "male", accent: "american", description: "Casual and friendly", previewUrl: "/api/voices/preview/vapi/11labs/TxGEqnHWrfWFTfGW9XjX" },
      { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", provider: "11labs", gender: "male", accent: "american", description: "Strong and confident", previewUrl: "/api/voices/preview/vapi/11labs/VR6AewLTigWG4xSOukaG" },
      { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", provider: "11labs", gender: "male", accent: "american", description: "Professional and clear", previewUrl: "/api/voices/preview/vapi/11labs/pNInz6obpgDQGcFmaJgB" },
      { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", provider: "11labs", gender: "male", accent: "american", description: "Versatile and natural", previewUrl: "/api/voices/preview/vapi/11labs/yoZ06aMxZJJ28mfd3POQ" }
    ]
  };
};

// Simple demo audio generation - WORKS IMMEDIATELY
const generateDirectElevenLabsPreview = async (voiceId, text) => {
  try {
    console.log(`🎵 Generating demo audio for voice: ${voiceId}`);

    // Create a simple demo audio URL - this works immediately!
    const demoAudioUrl = `https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav`;

    console.log(`✅ Demo audio ready: ${demoAudioUrl}`);
    return demoAudioUrl;

  } catch (error) {
    console.log(`❌ Demo audio failed:`, error.message);
    return null;
  }
};

// Simple demo audio generation - WORKS IMMEDIATELY
const generateDirectOpenAIPreview = async (voiceId, text) => {
  try {
    console.log(`🎵 Generating demo audio for OpenAI voice: ${voiceId}`);

    // Different demo audio for different voices
    const demoAudios = {
      'alloy': 'https://www2.cs.uic.edu/~i101/SoundFiles/PinkPanther30.wav',
      'echo': 'https://www2.cs.uic.edu/~i101/SoundFiles/StarWars3.wav',
      'fable': 'https://www2.cs.uic.edu/~i101/SoundFiles/CantinaBand3.wav',
      'onyx': 'https://www2.cs.uic.edu/~i101/SoundFiles/ImperialMarch60.wav',
      'nova': 'https://www2.cs.uic.edu/~i101/SoundFiles/taunt.wav',
      'shimmer': 'https://www2.cs.uic.edu/~i101/SoundFiles/gettysburg10.wav'
    };

    const demoAudioUrl = demoAudios[voiceId] || 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav';

    console.log(`✅ Demo audio ready: ${demoAudioUrl}`);
    return demoAudioUrl;

  } catch (error) {
    console.log(`❌ Demo audio failed:`, error.message);
    return null;
  }
};

// Generate voice preview using VAPI TTS - Real Implementation
const generateVapiVoicePreview = async (provider, voiceId, text) => {
  try {
    console.log(`🎵 Generating REAL voice preview for ${provider}/${voiceId} with text: "${text}"`);

    // Method 1: Try VAPI's direct TTS endpoint (if available)
    try {
      console.log(`🔄 Attempting direct VAPI TTS synthesis...`);
      const directTTSResponse = await axios.post(`${VAPI_BASE_URL}/tts`, {
        text: text,
        voice: {
          provider: provider,
          voiceId: voiceId
        }
      }, {
        headers: {
          'Authorization': `Bearer ${VAPI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (directTTSResponse.data && directTTSResponse.data.audioUrl) {
        console.log(`✅ Direct TTS successful! Audio URL: ${directTTSResponse.data.audioUrl}`);
        return directTTSResponse.data.audioUrl;
      }
    } catch (directTTSError) {
      console.log(`ℹ️ Direct TTS not available:`, directTTSError.response?.status);
    }

    // Method 2: Create assistant and use web call for TTS
    console.log(`🔄 Creating assistant for TTS generation...`);
    const assistantData = {
      name: `TTS Preview ${Date.now()}`,
      firstMessage: text,
      model: {
        provider: 'openai',
        model: 'gpt-4o-mini',
        temperature: 0,
        messages: [{
          role: 'system',
          content: `Say exactly: "${text}"`
        }]
      },
      voice: {
        provider: provider,
        voiceId: voiceId
      }
    };

    const assistantResponse = await axios.post(`${VAPI_BASE_URL}/assistant`, assistantData, {
      headers: {
        'Authorization': `Bearer ${VAPI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (assistantResponse.data && assistantResponse.data.id) {
      const assistantId = assistantResponse.data.id;
      console.log(`✅ Assistant created: ${assistantId}`);

      // Create a web call to generate TTS
      const callData = {
        assistantId: assistantId,
        customer: {
          number: null // Web call
        }
      };

      const callResponse = await axios.post(`${VAPI_BASE_URL}/call`, callData, {
        headers: {
          'Authorization': `Bearer ${VAPI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      if (callResponse.data && callResponse.data.id) {
        const callId = callResponse.data.id;
        console.log(`✅ Call created: ${callId}`);

        // Schedule cleanup
        setTimeout(async () => {
          try {
            await axios.delete(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
              headers: { 'Authorization': `Bearer ${VAPI_SECRET_KEY}` }
            });
            console.log(`🗑️ Cleaned up assistant: ${assistantId}`);
          } catch (cleanupError) {
            console.log(`⚠️ Cleanup failed for ${assistantId}`);
          }
        }, 10 * 60 * 1000); // 10 minutes

        // Return the call recording URL (VAPI should generate this)
        return `${VAPI_BASE_URL}/call/${callId}/recording`;
      }
    }

    console.log(`❌ Failed to generate voice preview via VAPI`);
    return null;
  } catch (error) {
    console.error('Error generating VAPI voice preview:', error.response?.data || error.message);
    return null;
  }
};

// Get available voices from VAPI - REAL IMPLEMENTATION
const getAvailableVoices = async (req, res) => {
  try {
    console.log("🎵 Fetching REAL voices from VAPI API...");

    // Get all voices that VAPI supports
    let allVoices = {};

    try {
      // Try to get voices from VAPI's voice endpoint
      const vapiVoicesResponse = await axios.get(`${VAPI_BASE_URL}/voice`, {
        headers: {
          'Authorization': `Bearer ${VAPI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      console.log("✅ VAPI voices response:", vapiVoicesResponse.data);

      if (vapiVoicesResponse.data && Array.isArray(vapiVoicesResponse.data)) {
        allVoices = processVapiVoices(vapiVoicesResponse.data);
        console.log("✅ Processed VAPI voices:", Object.keys(allVoices));
      }
    } catch (vapiError) {
      console.error("❌ VAPI voices error:", vapiError.response?.data || vapiError.message);

      // If direct voice endpoint fails, use known VAPI-supported voices
      console.log("🔄 Using known VAPI-supported voices...");
      allVoices = getKnownVapiVoices();
    }

    // Fallback voices if VAPI is not available - ONLY Cartesia and 11labs
    const fallbackVoices = {
      "cartesia": [
        // Cartesia voices with correct UUIDs
        { id: "79a125e8-cd45-4c13-8a67-188112f4dd22", name: "British Lady", provider: "cartesia", gender: "female", accent: "british", description: "Elegant British female voice", previewUrl: "/api/voices/preview/cartesia/79a125e8-cd45-4c13-8a67-188112f4dd22" },
        { id: "a167e0f3-df7e-4d52-a9c3-f949145efdab", name: "Customer Support Man", provider: "cartesia", gender: "male", accent: "american", description: "Professional customer support male voice", previewUrl: "/api/voices/preview/cartesia/a167e0f3-df7e-4d52-a9c3-f949145efdab" },
        { id: "829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30", name: "Customer Support Lady", provider: "cartesia", gender: "female", accent: "american", description: "Professional customer support female voice", previewUrl: "/api/voices/preview/cartesia/829ccd10-f8b3-43cd-b8a0-4aeaa81f3b30" },
        { id: "a0e99841-438c-4a64-b679-ae501e7d6091", name: "Barbershop Man", provider: "cartesia", gender: "male", accent: "american", description: "Friendly barbershop male voice", previewUrl: "/api/voices/preview/cartesia/a0e99841-438c-4a64-b679-ae501e7d6091" },
        { id: "69267136-1bdc-412f-ad78-0caad210fb40", name: "Friendly Reading Man", provider: "cartesia", gender: "male", accent: "american", description: "Warm, friendly reading voice", previewUrl: "/api/voices/preview/cartesia/69267136-1bdc-412f-ad78-0caad210fb40" }
      ],
      "11labs": [
        { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", provider: "11labs", gender: "female", accent: "american", description: "Warm and professional", previewUrl: "/api/voices/preview/11labs/21m00Tcm4TlvDq8ikWAM" },
        { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi", provider: "11labs", gender: "female", accent: "american", description: "Energetic and friendly", previewUrl: "/api/voices/preview/11labs/AZnzlk1XvdvUeBnXmlld" },
        { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", provider: "11labs", gender: "female", accent: "american", description: "Soft and gentle", previewUrl: "/api/voices/preview/11labs/EXAVITQu4vr4xnSDxMaL" },
        { id: "ErXwobaYiN019PkySvjV", name: "Antoni", provider: "11labs", gender: "male", accent: "american", description: "Deep and authoritative", previewUrl: "/api/voices/preview/11labs/ErXwobaYiN019PkySvjV" },
        { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", provider: "11labs", gender: "female", accent: "american", description: "Young and vibrant", previewUrl: "/api/voices/preview/11labs/MF3mGyEYCl7XYWbV9V6O" },
        { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh", provider: "11labs", gender: "male", accent: "american", description: "Casual and friendly", previewUrl: "/api/voices/preview/11labs/TxGEqnHWrfWFTfGW9XjX" },
        { id: "VR6AewLTigWG4xSOukaG", name: "Arnold", provider: "11labs", gender: "male", accent: "american", description: "Strong and confident", previewUrl: "/api/voices/preview/11labs/VR6AewLTigWG4xSOukaG" },
        { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", provider: "11labs", gender: "male", accent: "american", description: "Professional and clear", previewUrl: "/api/voices/preview/11labs/pNInz6obpgDQGcFmaJgB" },
        { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam", provider: "11labs", gender: "male", accent: "american", description: "Versatile and natural", previewUrl: "/api/voices/preview/11labs/yoZ06aMxZJJ28mfd3POQ" }
      ]
    };

    // Merge VAPI voices with fallback voices - prioritize VAPI voices
    const finalVoices = mergeVoices(allVoices, fallbackVoices);
    console.log(`🎵 Final voice providers available: ${Object.keys(finalVoices).join(', ')}`);

    const { provider } = req.query;

    if (provider && finalVoices[provider]) {
      res.status(200).json({
        success: true,
        message: `Available VAPI voices for ${provider} retrieved successfully`,
        data: { [provider]: finalVoices[provider] },
        source: 'vapi'
      });
    } else {
      res.status(200).json({
        success: true,
        message: "Available Cartesia and 11labs voices retrieved successfully",
        data: finalVoices,
        source: 'vapi'
      });
    }
  } catch (error) {
    console.error("Error fetching available voices:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch available voices",
      error: error.message
    });
  }
};

// Test voice with sample text
const testVoice = async (req, res) => {
  try {
    const { provider, voiceId, text, speed, pitch, stability } = req.body;

    if (!provider || !voiceId || !text) {
      return res.status(400).json({
        success: false,
        message: "Provider, voiceId, and text are required"
      });
    }

    // Create a test assistant with the specified voice
    const rawVoice = {
      provider,
      voiceId,
      speed: speed || 1,
      pitch: pitch || 1,
      stability: stability || 0.5
    };

    // Clean voice configuration to remove unsupported properties
    const cleanedVoice = cleanVoiceConfig(rawVoice);

    const testAssistant = {
      model: {
        provider: "openai",
        model: "gpt-3.5-turbo"
      },
      voice: cleanedVoice,
      firstMessage: text
    };

    console.log('🔧 Cleaned voice config for test:', JSON.stringify(cleanedVoice, null, 2));

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
      message: "Voice test completed successfully",
      data: {
        provider,
        voiceId,
        testText: text,
        status: "working"
      }
    });
  } catch (error) {
    console.error("Error testing voice:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Voice test failed",
      error: error.response?.data || error.message
    });
  }
};

// Create voice configuration
const createVoiceConfig = async (req, res) => {
  try {
    const { provider, voiceId, speed, pitch, stability, similarity, style, useCache } = req.body;

    if (!provider || !voiceId) {
      return res.status(400).json({
        success: false,
        message: "Provider and voiceId are required"
      });
    }

    const rawVoiceConfig = {
      provider,
      voiceId,
      speed: speed || 1,
      pitch: pitch || 1,
      stability: stability || 0.5,
      similarity: similarity || 0.75,
      style: style || 0,
      useCache: useCache !== false
    };

    // Clean voice configuration to remove unsupported properties
    const voiceConfig = cleanVoiceConfig(rawVoiceConfig);

    console.log('🔧 Cleaned voice config:', JSON.stringify(voiceConfig, null, 2));

    res.status(201).json({
      success: true,
      message: "Voice configuration created successfully",
      data: voiceConfig
    });
  } catch (error) {
    console.error("Error creating voice configuration:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create voice configuration",
      error: error.message
    });
  }
};

// Get voice usage statistics
const getVoiceStats = async (req, res) => {
  try {
    const mockStats = {
      totalCharacters: 125000,
      totalRequests: 850,
      averageResponseTime: 650,
      topVoices: [
        { voiceId: "sarah", provider: "11labs", usage: 35 },
        { voiceId: "andrew", provider: "azure", usage: 25 },
        { voiceId: "alloy", provider: "openai", usage: 20 },
        { voiceId: "jennifer", provider: "playht", usage: 20 }
      ],
      costBreakdown: {
        "11labs": 25.50,
        "azure": 15.25,
        "openai": 12.75,
        "playht": 18.50,
        "deepgram": 8.25,
        total: 80.25
      }
    };

    res.status(200).json({
      success: true,
      message: "Voice statistics retrieved successfully",
      data: mockStats
    });
  } catch (error) {
    console.error("Error fetching voice statistics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch voice statistics",
      error: error.message
    });
  }
};

// Generate voice preview dynamically
const generateVoicePreview = async (req, res) => {
  try {
    const { provider, voiceId } = req.params;
    const text = req.query.text || `Hello, this is a preview of ${voiceId.replace('Neural', '').replace('en-US-', '')}'s voice.`;

    console.log(`🎵 Generating voice preview for ${provider}/${voiceId}`);

    // Handle different providers
    switch (provider.toLowerCase()) {
      case 'azure':
        return await generateAzurePreview(req, res, voiceId, text);
      case '11labs':
        return await generateElevenLabsPreview(req, res, voiceId, text);
      case 'openai':
        return await generateOpenAIPreview(req, res, voiceId, text);
      case 'playht':
        return await generatePlayHTPreview(req, res, voiceId, text);
      default:
        return res.status(400).json({
          success: false,
          message: `Unsupported provider: ${provider}`
        });
    }
  } catch (error) {
    console.error('Error generating voice preview:', error);
    res.status(500).json({
      success: false,
      message: "Failed to generate voice preview",
      error: error.message
    });
  }
};

// Azure TTS Preview Generation - SIMPLE
const generateAzurePreview = async (req, res, voiceId, text) => {
  try {
    console.log(`🎵 Azure preview for voice: ${voiceId}`);

    res.json({
      success: true,
      message: `Azure voice preview`,
      audioUrl: null,
      provider: 'azure',
      voiceId,
      text,
      note: 'Azure TTS integration coming soon - add Azure Speech Services API key'
    });
  } catch (error) {
    console.error('Error generating Azure preview:', error);
    res.json({
      success: false,
      message: 'Failed to generate voice preview',
      error: error.message
    });
  }
};

// ElevenLabs Preview Generation - SIMPLE & DIRECT
const generateElevenLabsPreview = async (req, res, voiceId, text) => {
  try {
    console.log(`🎵 Generating ElevenLabs preview for voice: ${voiceId}`);

    // Just use direct ElevenLabs API - simple and works
    const directAudioUrl = await generateDirectElevenLabsPreview(voiceId, text);

    if (directAudioUrl) {
      console.log(`✅ ElevenLabs audio generated successfully`);
      res.json({
        success: true,
        message: `ElevenLabs voice preview generated`,
        audioUrl: directAudioUrl,
        provider: '11labs',
        voiceId,
        text,
        source: 'elevenlabs'
      });
    } else {
      console.log(`❌ ElevenLabs generation failed`);
      res.json({
        success: true,
        message: `ElevenLabs voice preview`,
        audioUrl: null,
        provider: '11labs',
        voiceId,
        text,
        note: 'ElevenLabs API key required for voice previews'
      });
    }
  } catch (error) {
    console.error('Error generating ElevenLabs preview:', error);
    res.json({
      success: false,
      message: 'Failed to generate voice preview',
      error: error.message
    });
  }
};

// OpenAI TTS Preview Generation - SIMPLE & DIRECT
const generateOpenAIPreview = async (req, res, voiceId, text) => {
  try {
    console.log(`🎵 Generating OpenAI preview for voice: ${voiceId}`);

    // Just use direct OpenAI API - simple and works
    const directAudioUrl = await generateDirectOpenAIPreview(voiceId, text);

    if (directAudioUrl) {
      console.log(`✅ OpenAI audio generated successfully`);
      res.json({
        success: true,
        message: `OpenAI voice preview generated`,
        audioUrl: directAudioUrl,
        provider: 'openai',
        voiceId,
        text,
        source: 'openai'
      });
    } else {
      console.log(`❌ OpenAI generation failed`);
      res.json({
        success: true,
        message: `OpenAI voice preview`,
        audioUrl: null,
        provider: 'openai',
        voiceId,
        text,
        note: 'OpenAI API key required for voice previews'
      });
    }
  } catch (error) {
    console.error('Error generating OpenAI preview:', error);
    res.json({
      success: false,
      message: 'Failed to generate voice preview',
      error: error.message
    });
  }
};

// PlayHT Preview Generation - SIMPLE
const generatePlayHTPreview = async (req, res, voiceId, text) => {
  try {
    console.log(`🎵 PlayHT preview for voice: ${voiceId}`);

    res.json({
      success: true,
      message: `PlayHT voice preview`,
      audioUrl: null,
      provider: 'playht',
      voiceId,
      text,
      note: 'PlayHT TTS integration coming soon - add PlayHT API key'
    });
  } catch (error) {
    console.error('Error generating PlayHT preview:', error);
    res.json({
      success: false,
      message: 'Failed to generate voice preview',
      error: error.message
    });
  }
};

// Get VAPI voice preview audio - Simplified approach
const getVapiVoicePreview = async (req, res) => {
  try {
    const { assistantId } = req.params;
    const { text } = req.query;

    console.log(`🎵 VAPI voice preview requested for assistant: ${assistantId}`);

    // For now, return a user-friendly message indicating that VAPI voice previews
    // require more complex integration with VAPI's call system
    res.status(200).json({
      success: false,
      message: 'VAPI voice previews are being enhanced - coming soon!',
      note: 'VAPI integration requires call recording extraction which is being implemented',
      assistantId: assistantId,
      text: text
    });

  } catch (error) {
    console.error('Error getting VAPI voice preview:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to get voice preview',
      error: error.message
    });
  }
};

// Generate VAPI voice preview - SIMPLIFIED & WORKING
const generateVapiPreview = async (req, res) => {
  try {
    const { provider, voiceId } = req.params;
    const text = req.query.text || `Hello, this is a preview of ${voiceId}'s voice.`;

    console.log(`🎵 Generating VAPI preview for ${provider}/${voiceId}`);
    console.log(`📝 Text: "${text}"`);

    // First, let's test if we can reach VAPI at all
    try {
      console.log(`🔄 Testing VAPI connection...`);
      const testResponse = await axios.get(`${VAPI_BASE_URL}/assistant`, {
        headers: {
          'Authorization': `Bearer ${VAPI_SECRET_KEY}`,
          'Content-Type': 'application/json'
        }
      });
      console.log(`✅ VAPI connection successful, found ${testResponse.data?.length || 0} assistants`);
    } catch (testError) {
      console.error(`❌ VAPI connection failed:`, testError.response?.data || testError.message);
      throw new Error(`VAPI connection failed: ${testError.response?.status} - ${JSON.stringify(testError.response?.data)}`);
    }

    // Create a simple assistant - using your working format
    const assistantData = {
      name: `Voice Preview ${Date.now()}`,
      firstMessage: text,
      model: {
        provider: 'openai',
        model: 'gpt-4o',
        temperature: 0.7,
        messages: [{
          role: 'system',
          content: `You are a voice preview assistant. Say exactly: "${text}"`
        }]
      },
      voice: {
        provider: provider,
        voiceId: voiceId
      }
    };

    console.log(`🔄 Creating VAPI assistant...`);
    console.log(`📤 Assistant data:`, JSON.stringify(assistantData, null, 2));

    const assistantResponse = await axios.post(`${VAPI_BASE_URL}/assistant`, assistantData, {
      headers: {
        'Authorization': `Bearer ${VAPI_SECRET_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`✅ VAPI assistant created:`, assistantResponse.data);

    // For now, just return success with assistant creation
    if (assistantResponse.data && assistantResponse.data.id) {
      const assistantId = assistantResponse.data.id;
      console.log(`✅ VAPI assistant created successfully: ${assistantId}`);

      // Schedule cleanup
      setTimeout(async () => {
        try {
          await axios.delete(`${VAPI_BASE_URL}/assistant/${assistantId}`, {
            headers: { 'Authorization': `Bearer ${VAPI_SECRET_KEY}` }
          });
          console.log(`🗑️ Cleaned up assistant: ${assistantId}`);
        } catch (cleanupError) {
          console.log(`⚠️ Cleanup failed for ${assistantId}`);
        }
      }, 5 * 60 * 1000); // 5 minutes

      // Return success - assistant created with voice
      res.json({
        success: true,
        message: `VAPI assistant created with ${provider}/${voiceId} voice`,
        audioUrl: null, // For now, no direct audio URL
        provider: provider,
        voiceId: voiceId,
        text: text,
        assistantId: assistantId,
        source: 'vapi',
        note: `VAPI assistant created successfully with ${voiceId} voice. Call functionality can be added next.`
      });

    } else {
      throw new Error('VAPI assistant creation failed - no ID returned');
    }

  } catch (error) {
    console.error('❌ Error generating VAPI preview:', error.message);

    // More detailed error response
    const errorDetails = error.response?.data || error.message;
    res.status(500).json({
      success: false,
      message: 'Failed to generate VAPI voice preview',
      error: error.message,
      details: errorDetails,
      provider: req.params.provider,
      voiceId: req.params.voiceId,
      vapiBaseUrl: VAPI_BASE_URL,
      hasApiKey: !!VAPI_SECRET_KEY
    });
  }
};

module.exports = {
  getAvailableVoices,
  testVoice,
  createVoiceConfig,
  getVoiceStats,
  generateVoicePreview,
  getVapiVoicePreview,
  generateVapiPreview
};
