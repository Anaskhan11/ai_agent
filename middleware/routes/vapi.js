const express = require('express');
const router = express.Router();
const axios = require('axios');
const authenticateToken = require('../middleware/authMiddleware');

// VAPI Configuration
const VAPI_API_KEY = process.env.VAPI_API_KEY;
const VAPI_BASE_URL = 'https://api.vapi.ai';

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

// Create VAPI Assistant
router.post('/assistants', authenticateToken, async (req, res) => {
  try {
    console.log('🔄 Creating VAPI assistant...');
    console.log('📋 Request body:', req.body);

    if (!VAPI_API_KEY) {
      console.error('❌ VAPI API key not configured');
      return res.status(500).json({
        success: false,
        error: 'VAPI API key not configured on server'
      });
    }

    const {
      name,
      firstMessage,
      model,
      voice,
      metadata
    } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Assistant name is required'
      });
    }

    // Prepare VAPI assistant data
    const defaultVoice = {
      provider: voice?.provider || 'vapi',
      voiceId: voice?.voiceId || 'Cole'
    };

    // Clean voice configuration to remove unsupported properties
    const cleanedVoice = voice ? cleanVoiceConfig(voice) : cleanVoiceConfig(defaultVoice);

    const assistantData = {
      name: name,
      firstMessage: firstMessage || `Hello! I'm ${name}. How can I help you today?`,
      model: {
        provider: model?.provider || 'openai',
        model: model?.model || 'gpt-4o',
        temperature: model?.temperature || 0.7,
        messages: model?.messages || [{
          role: 'system',
          content: `You are ${name}, a helpful AI assistant. Keep responses conversational and under 30 words when possible.`
        }]
      },
      voice: cleanedVoice,
      metadata: metadata || {}
    };

    console.log('🔧 Cleaned voice config for VAPI creation:', JSON.stringify(cleanedVoice, null, 2));

    console.log('📤 Sending to VAPI:', assistantData);

    // Create assistant in VAPI
    const response = await axios.post(`${VAPI_BASE_URL}/assistant`, assistantData, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ VAPI response:', response.data);

    res.json({
      success: true,
      assistant: response.data,
      message: 'Assistant created successfully'
    });

  } catch (error) {
    console.error('❌ Error creating VAPI assistant:', error);
    
    let errorMessage = 'Failed to create assistant';
    let statusCode = 500;

    if (error.response) {
      // VAPI API error
      console.error('❌ VAPI API Error:', error.response.data);
      errorMessage = error.response.data?.message || error.response.data?.error || 'VAPI API error';
      statusCode = error.response.status;
    } else if (error.request) {
      // Network error
      console.error('❌ Network Error:', error.request);
      errorMessage = 'Network error connecting to VAPI';
    } else {
      // Other error
      console.error('❌ Error:', error.message);
      errorMessage = error.message;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Get VAPI Assistant
router.get('/assistants/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!VAPI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'VAPI API key not configured on server'
      });
    }

    const response = await axios.get(`${VAPI_BASE_URL}/assistant/${id}`, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      assistant: response.data
    });

  } catch (error) {
    console.error('❌ Error getting VAPI assistant:', error);
    
    let errorMessage = 'Failed to get assistant';
    let statusCode = 500;

    if (error.response) {
      errorMessage = error.response.data?.message || error.response.data?.error || 'VAPI API error';
      statusCode = error.response.status;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// List VAPI Assistants
router.get('/assistants', authenticateToken, async (req, res) => {
  try {
    if (!VAPI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'VAPI API key not configured on server'
      });
    }

    const response = await axios.get(`${VAPI_BASE_URL}/assistant`, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      assistants: response.data
    });

  } catch (error) {
    console.error('❌ Error listing VAPI assistants:', error);
    
    let errorMessage = 'Failed to list assistants';
    let statusCode = 500;

    if (error.response) {
      errorMessage = error.response.data?.message || error.response.data?.error || 'VAPI API error';
      statusCode = error.response.status;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Update VAPI Assistant
router.put('/assistants/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!VAPI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'VAPI API key not configured on server'
      });
    }

    // Clean the payload to remove unsupported properties
    const payload = { ...req.body };

    // Clean voice configuration if present
    if (payload.voice) {
      payload.voice = cleanVoiceConfig(payload.voice);
      console.log('🔧 Cleaned voice config for VAPI update:', JSON.stringify(payload.voice, null, 2));
    }

    const response = await axios.patch(`${VAPI_BASE_URL}/assistant/${id}`, payload, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      assistant: response.data,
      message: 'Assistant updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating VAPI assistant:', error);
    
    let errorMessage = 'Failed to update assistant';
    let statusCode = 500;

    if (error.response) {
      errorMessage = error.response.data?.message || error.response.data?.error || 'VAPI API error';
      statusCode = error.response.status;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

// Delete VAPI Assistant
router.delete('/assistants/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;

    if (!VAPI_API_KEY) {
      return res.status(500).json({
        success: false,
        error: 'VAPI API key not configured on server'
      });
    }

    await axios.delete(`${VAPI_BASE_URL}/assistant/${id}`, {
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    res.json({
      success: true,
      message: 'Assistant deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting VAPI assistant:', error);
    
    let errorMessage = 'Failed to delete assistant';
    let statusCode = 500;

    if (error.response) {
      errorMessage = error.response.data?.message || error.response.data?.error || 'VAPI API error';
      statusCode = error.response.status;
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage
    });
  }
});

module.exports = router;
