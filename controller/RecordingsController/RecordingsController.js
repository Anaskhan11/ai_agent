const axios = require("axios");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files only
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'), false);
    }
  }
});

// Mock recordings data for development
const mockRecordings = [
  {
    id: "rec_1",
    recordingName: "Customer Support Call - Sarah Johnson",
    duration: "15:30",
    date: "2024-11-01T10:30:00Z",
    type: "Support",
    status: "completed",
    fileSize: "12.5 MB",
    format: "mp3",
    transcript: "Hello, I'm calling about my recent order...",
    callId: "call_123",
    assistantId: "asst_456",
    phoneNumber: "+1234567890",
    cost: 0.25,
    metadata: {
      quality: "high",
      sampleRate: 44100,
      channels: 1
    },
    createdAt: "2024-11-01T10:30:00Z",
    updatedAt: "2024-11-01T10:45:30Z"
  },
  {
    id: "rec_2",
    recordingName: "Sales Call - John Smith",
    duration: "25:45",
    date: "2024-10-15T14:20:00Z",
    type: "Sales",
    status: "completed",
    fileSize: "20.8 MB",
    format: "mp3",
    transcript: "Thank you for your interest in our product...",
    callId: "call_124",
    assistantId: "asst_789",
    phoneNumber: "+1987654321",
    cost: 0.42,
    metadata: {
      quality: "high",
      sampleRate: 44100,
      channels: 1
    },
    createdAt: "2024-10-15T14:20:00Z",
    updatedAt: "2024-10-15T14:45:45Z"
  },
  {
    id: "rec_3",
    recordingName: "Product Demo - Alice Johnson",
    duration: "32:10",
    date: "2024-10-05T09:15:00Z",
    type: "Demo",
    status: "completed",
    fileSize: "26.2 MB",
    format: "mp3",
    transcript: "Welcome to our product demonstration...",
    callId: "call_125",
    assistantId: "asst_456",
    phoneNumber: "+1555123456",
    cost: 0.52,
    metadata: {
      quality: "high",
      sampleRate: 44100,
      channels: 1
    },
    createdAt: "2024-10-05T09:15:00Z",
    updatedAt: "2024-10-05T09:47:10Z"
  },
  {
    id: "rec_4",
    recordingName: "Follow-up Call - Bob Williams",
    duration: "18:45",
    date: "2024-09-22T16:30:00Z",
    type: "Follow-up",
    status: "completed",
    fileSize: "15.1 MB",
    format: "mp3",
    transcript: "Hi Bob, this is a follow-up call regarding...",
    callId: "call_126",
    assistantId: "asst_789",
    phoneNumber: "+1444987654",
    cost: 0.31,
    metadata: {
      quality: "high",
      sampleRate: 44100,
      channels: 1
    },
    createdAt: "2024-09-22T16:30:00Z",
    updatedAt: "2024-09-22T16:48:45Z"
  },
  {
    id: "rec_5",
    recordingName: "Customer Feedback Session",
    duration: "45:30",
    date: "2024-11-10T11:00:00Z",
    type: "Feedback",
    status: "completed",
    fileSize: "36.8 MB",
    format: "mp3",
    transcript: "We appreciate you taking the time to provide feedback...",
    callId: "call_127",
    assistantId: "asst_456",
    phoneNumber: "+1333555777",
    cost: 0.74,
    metadata: {
      quality: "high",
      sampleRate: 44100,
      channels: 1
    },
    createdAt: "2024-11-10T11:00:00Z",
    updatedAt: "2024-11-10T11:45:30Z"
  }
];

// List all recordings
const listRecordings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      type,
      status,
      startDate,
      endDate,
      assistantId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Try to fetch from VAPI first
    try {
      const params = new URLSearchParams();
      if (page) params.append('page', page);
      if (limit) params.append('limit', limit);
      if (search) params.append('search', search);
      if (type) params.append('type', type);
      if (status) params.append('status', status);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (assistantId) params.append('assistantId', assistantId);
      if (sortBy) params.append('sortBy', sortBy);
      if (sortOrder) params.append('sortOrder', sortOrder);

      const response = await axios.get(`${VAPI_BASE_URL}/recordings?${params.toString()}`, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      });

      return res.status(200).json({
        success: true,
        message: "Recordings retrieved successfully",
        data: response.data
      });
    } catch (error) {
      // If VAPI endpoint doesn't exist, use mock data
      if (error.response?.status === 404) {
        let filteredRecordings = [...mockRecordings];

        // Apply filters
        if (search) {
          filteredRecordings = filteredRecordings.filter(recording =>
            recording.recordingName.toLowerCase().includes(search.toLowerCase()) ||
            recording.transcript.toLowerCase().includes(search.toLowerCase())
          );
        }

        if (type) {
          filteredRecordings = filteredRecordings.filter(recording =>
            recording.type.toLowerCase() === type.toLowerCase()
          );
        }

        if (status) {
          filteredRecordings = filteredRecordings.filter(recording =>
            recording.status === status
          );
        }

        if (startDate) {
          filteredRecordings = filteredRecordings.filter(recording =>
            new Date(recording.date) >= new Date(startDate)
          );
        }

        if (endDate) {
          filteredRecordings = filteredRecordings.filter(recording =>
            new Date(recording.date) <= new Date(endDate)
          );
        }

        if (assistantId) {
          filteredRecordings = filteredRecordings.filter(recording =>
            recording.assistantId === assistantId
          );
        }

        // Apply sorting
        filteredRecordings.sort((a, b) => {
          const aValue = a[sortBy];
          const bValue = b[sortBy];
          
          if (sortOrder === 'desc') {
            return bValue > aValue ? 1 : -1;
          } else {
            return aValue > bValue ? 1 : -1;
          }
        });

        // Apply pagination
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + parseInt(limit);
        const paginatedRecordings = filteredRecordings.slice(startIndex, endIndex);

        const totalRecordings = filteredRecordings.length;
        const totalPages = Math.ceil(totalRecordings / limit);

        return res.status(200).json({
          success: true,
          message: "Recordings retrieved successfully (simulated)",
          data: {
            recordings: paginatedRecordings,
            pagination: {
              currentPage: parseInt(page),
              totalPages,
              totalRecordings,
              hasNextPage: page < totalPages,
              hasPrevPage: page > 1
            },
            filters: {
              search: search || null,
              type: type || null,
              status: status || null,
              startDate: startDate || null,
              endDate: endDate || null,
              assistantId: assistantId || null
            }
          }
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error listing recordings:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recordings",
      error: error.message
    });
  }
};

// Get recording by ID
const getRecording = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to fetch from VAPI first
    try {
      const response = await axios.get(`${VAPI_BASE_URL}/recordings/${id}`, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      });

      return res.status(200).json({
        success: true,
        message: "Recording retrieved successfully",
        data: response.data
      });
    } catch (error) {
      // If VAPI endpoint doesn't exist, use mock data
      if (error.response?.status === 404) {
        const recording = mockRecordings.find(r => r.id === id);

        if (!recording) {
          return res.status(404).json({
            success: false,
            message: "Recording not found"
          });
        }

        return res.status(200).json({
          success: true,
          message: "Recording retrieved successfully (simulated)",
          data: recording
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error fetching recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recording",
      error: error.message
    });
  }
};

// Upload recording
const uploadRecording = async (req, res) => {
  try {
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({
          success: false,
          message: err.message
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No audio file provided"
        });
      }

      const { recordingName, type, assistantId, callId, phoneNumber } = req.body;

      if (!recordingName) {
        return res.status(400).json({
          success: false,
          message: "Recording name is required"
        });
      }

      // Create mock recording data
      const newRecording = {
        id: `rec_${Date.now()}`,
        recordingName,
        duration: "00:00", // Would be calculated from actual file
        date: new Date().toISOString(),
        type: type || "General",
        status: "processing",
        fileSize: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
        format: req.file.mimetype.split('/')[1],
        transcript: "",
        callId: callId || null,
        assistantId: assistantId || null,
        phoneNumber: phoneNumber || null,
        cost: 0,
        metadata: {
          quality: "high",
          sampleRate: 44100,
          channels: 1,
          originalName: req.file.originalname
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // In a real implementation, you would:
      // 1. Save the file to storage (AWS S3, etc.)
      // 2. Process the audio file to get duration, quality metrics
      // 3. Generate transcript using speech-to-text service
      // 4. Save metadata to database

      res.status(201).json({
        success: true,
        message: "Recording uploaded successfully",
        data: newRecording
      });
    });
  } catch (error) {
    console.error("Error uploading recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload recording",
      error: error.message
    });
  }
};

// Update recording
const updateRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Try to update via VAPI first
    try {
      const response = await axios.patch(`${VAPI_BASE_URL}/recordings/${id}`, updateData, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      });

      return res.status(200).json({
        success: true,
        message: "Recording updated successfully",
        data: response.data
      });
    } catch (error) {
      // If VAPI endpoint doesn't exist, simulate update
      if (error.response?.status === 404) {
        const recordingIndex = mockRecordings.findIndex(r => r.id === id);

        if (recordingIndex === -1) {
          return res.status(404).json({
            success: false,
            message: "Recording not found"
          });
        }

        const updatedRecording = {
          ...mockRecordings[recordingIndex],
          ...updateData,
          updatedAt: new Date().toISOString()
        };

        return res.status(200).json({
          success: true,
          message: "Recording updated successfully (simulated)",
          data: updatedRecording
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error updating recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update recording",
      error: error.message
    });
  }
};

// Delete recording
const deleteRecording = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to delete via VAPI first
    try {
      await axios.delete(`${VAPI_BASE_URL}/recordings/${id}`, {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          "Content-Type": "application/json"
        }
      });

      return res.status(200).json({
        success: true,
        message: "Recording deleted successfully"
      });
    } catch (error) {
      // If VAPI endpoint doesn't exist, simulate deletion
      if (error.response?.status === 404) {
        const recordingIndex = mockRecordings.findIndex(r => r.id === id);

        if (recordingIndex === -1) {
          return res.status(404).json({
            success: false,
            message: "Recording not found"
          });
        }

        return res.status(200).json({
          success: true,
          message: "Recording deleted successfully (simulated)"
        });
      }
      throw error;
    }
  } catch (error) {
    console.error("Error deleting recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete recording",
      error: error.message
    });
  }
};

// Stream recording audio
const streamRecording = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if this is a demo recording (starts with demo_)
    const isDemoRecording = id.startsWith('demo_');

    let recording;
    if (isDemoRecording) {
      // For demo recordings, create a mock recording object
      recording = {
        id: id,
        recordingName: `Demo Recording ${id}`,
        format: 'wav',
        duration: 5000 // 5 seconds
      };
    } else {
      // For real recordings, find in mock data
      recording = mockRecordings.find(r => r.id === id);
    }

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      });
    }

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', `audio/${recording.format}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', `inline; filename="${recording.recordingName}.${recording.format}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // For demo purposes, generate a simple audio tone or return a placeholder
    // In production, you would pipe the actual audio file stream

    // Generate a simple sine wave audio buffer (demo audio)
    const sampleRate = 44100;
    const duration = 5; // 5 seconds
    const samples = sampleRate * duration;
    const buffer = Buffer.alloc(samples * 2); // 16-bit audio

    for (let i = 0; i < samples; i++) {
      const sample = Math.sin(2 * Math.PI * 440 * i / sampleRate) * 0.3; // 440Hz tone at 30% volume
      const intSample = Math.round(sample * 32767);
      buffer.writeInt16LE(intSample, i * 2);
    }

    // Create a simple WAV header
    const wavHeader = Buffer.alloc(44);
    wavHeader.write('RIFF', 0);
    wavHeader.writeUInt32LE(36 + buffer.length, 4);
    wavHeader.write('WAVE', 8);
    wavHeader.write('fmt ', 12);
    wavHeader.writeUInt32LE(16, 16); // PCM format
    wavHeader.writeUInt16LE(1, 20); // PCM
    wavHeader.writeUInt16LE(1, 22); // Mono
    wavHeader.writeUInt32LE(sampleRate, 24);
    wavHeader.writeUInt32LE(sampleRate * 2, 28);
    wavHeader.writeUInt16LE(2, 32);
    wavHeader.writeUInt16LE(16, 34);
    wavHeader.write('data', 36);
    wavHeader.writeUInt32LE(buffer.length, 40);

    // Set correct content type for WAV
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Content-Length', wavHeader.length + buffer.length);

    // Send the WAV file
    res.write(wavHeader);
    res.end(buffer);

  } catch (error) {
    console.error("Error streaming recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to stream recording",
      error: error.message
    });
  }
};

// Download recording
const downloadRecording = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = mockRecordings.find(r => r.id === id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      });
    }

    // Set headers for file download
    res.setHeader('Content-Type', `audio/${recording.format}`);
    res.setHeader('Content-Disposition', `attachment; filename="${recording.recordingName}.${recording.format}"`);

    // For demo, return download info
    // In production, you would stream the actual file
    res.status(200).json({
      success: true,
      message: "Download ready",
      data: {
        downloadUrl: `/api/recordings/${id}/download`,
        filename: `${recording.recordingName}.${recording.format}`,
        fileSize: recording.fileSize,
        format: recording.format
      }
    });
  } catch (error) {
    console.error("Error downloading recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to download recording",
      error: error.message
    });
  }
};

// Get recording transcript
const getRecordingTranscript = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = mockRecordings.find(r => r.id === id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Transcript retrieved successfully",
      data: {
        recordingId: id,
        transcript: recording.transcript,
        confidence: 0.95,
        language: "en-US",
        wordCount: recording.transcript.split(' ').length,
        generatedAt: recording.createdAt
      }
    });
  } catch (error) {
    console.error("Error fetching transcript:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transcript",
      error: error.message
    });
  }
};

// Update recording transcript
const updateRecordingTranscript = async (req, res) => {
  try {
    const { id } = req.params;
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({
        success: false,
        message: "Transcript is required"
      });
    }

    const recording = mockRecordings.find(r => r.id === id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      });
    }

    // Update transcript
    recording.transcript = transcript;
    recording.updatedAt = new Date().toISOString();

    res.status(200).json({
      success: true,
      message: "Transcript updated successfully",
      data: {
        recordingId: id,
        transcript: recording.transcript,
        updatedAt: recording.updatedAt
      }
    });
  } catch (error) {
    console.error("Error updating transcript:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update transcript",
      error: error.message
    });
  }
};

// Get recording analytics
const getRecordingAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = mockRecordings.find(r => r.id === id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      });
    }

    const analytics = {
      recordingId: id,
      duration: recording.duration,
      fileSize: recording.fileSize,
      cost: recording.cost,
      quality: recording.metadata.quality,
      transcriptWordCount: recording.transcript.split(' ').length,
      playCount: Math.floor(Math.random() * 50) + 1,
      downloadCount: Math.floor(Math.random() * 10) + 1,
      shareCount: Math.floor(Math.random() * 5),
      lastPlayed: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      averageListenDuration: "12:30",
      completionRate: "85%"
    };

    res.status(200).json({
      success: true,
      message: "Recording analytics retrieved successfully",
      data: analytics
    });
  } catch (error) {
    console.error("Error fetching recording analytics:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recording analytics",
      error: error.message
    });
  }
};

// Share recording
const shareRecording = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, message, expiresIn = "7d" } = req.body;

    const recording = mockRecordings.find(r => r.id === id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      });
    }

    // Generate share link (in production, this would be a secure token)
    const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const shareLink = `${req.protocol}://${req.get('host')}/shared/recordings/${shareToken}`;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiresIn === "7d" ? 7 : 1));

    res.status(200).json({
      success: true,
      message: "Recording shared successfully",
      data: {
        shareLink,
        shareToken,
        expiresAt: expiresAt.toISOString(),
        sharedWith: email || "public",
        message: message || null
      }
    });
  } catch (error) {
    console.error("Error sharing recording:", error);
    res.status(500).json({
      success: false,
      message: "Failed to share recording",
      error: error.message
    });
  }
};

// Get recording metadata
const getRecordingMetadata = async (req, res) => {
  try {
    const { id } = req.params;

    const recording = mockRecordings.find(r => r.id === id);

    if (!recording) {
      return res.status(404).json({
        success: false,
        message: "Recording not found"
      });
    }

    res.status(200).json({
      success: true,
      message: "Recording metadata retrieved successfully",
      data: {
        id: recording.id,
        recordingName: recording.recordingName,
        duration: recording.duration,
        fileSize: recording.fileSize,
        format: recording.format,
        type: recording.type,
        status: recording.status,
        metadata: recording.metadata,
        createdAt: recording.createdAt,
        updatedAt: recording.updatedAt,
        callId: recording.callId,
        assistantId: recording.assistantId,
        phoneNumber: recording.phoneNumber,
        cost: recording.cost
      }
    });
  } catch (error) {
    console.error("Error fetching recording metadata:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch recording metadata",
      error: error.message
    });
  }
};

module.exports = {
  listRecordings,
  getRecording,
  uploadRecording,
  updateRecording,
  deleteRecording,
  streamRecording,
  downloadRecording,
  getRecordingTranscript,
  updateRecordingTranscript,
  getRecordingAnalytics,
  shareRecording,
  getRecordingMetadata,
  upload
};
