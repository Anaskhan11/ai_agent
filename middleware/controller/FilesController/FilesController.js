const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");
const systemAuditLogger = require("../../utils/systemAuditLogger");
require("dotenv").config();

const VAPI_BASE_URL = "https://api.vapi.ai";
const VAPI_SECRET_KEY = process.env.VAPI_SECRET_KEY;

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// List all files
const listFiles = async (req, res) => {
  try {
    const response = await axios.get(`${VAPI_BASE_URL}/file`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "Files retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching files:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch files",
      error: error.response?.data || error.message
    });
  }
};

// Get file by ID
const getFile = async (req, res) => {
  try {
    const { id } = req.params;

    const response = await axios.get(`${VAPI_BASE_URL}/file/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "File retrieved successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error fetching file:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to fetch file",
      error: error.response?.data || error.message
    });
  }
};

// Upload file
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file provided"
      });
    }

    const { name, description } = req.body;
    
    const formData = new FormData();
    formData.append('file', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });
    
    if (name) formData.append('name', name);
    if (description) formData.append('description', description);

    const response = await axios.post(
      `${VAPI_BASE_URL}/file`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${VAPI_SECRET_KEY}`,
          ...formData.getHeaders()
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      }
    );

    // Log successful file upload
    await systemAuditLogger.logFileOperation(req, 'UPLOAD', req.file.originalname,
      { size: req.file.size, mimetype: req.file.mimetype, name, description }, true);

    res.status(201).json({
      success: true,
      message: "File uploaded successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error uploading file:", error.response?.data || error.message);

    // Log failed file upload
    await systemAuditLogger.logFileOperation(req, 'UPLOAD', req.file?.originalname || 'unknown',
      { size: req.file?.size, mimetype: req.file?.mimetype }, false, error.message);

    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to upload file",
      error: error.response?.data || error.message
    });
  }
};

// Update file
const updateFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;

    const response = await axios.patch(
      `${VAPI_BASE_URL}/file/${id}`,
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
      message: "File updated successfully",
      data: response.data
    });
  } catch (error) {
    console.error("Error updating file:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to update file",
      error: error.response?.data || error.message
    });
  }
};

// Delete file
const deleteFile = async (req, res) => {
  try {
    const { id } = req.params;

    await axios.delete(`${VAPI_BASE_URL}/file/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    res.status(200).json({
      success: true,
      message: "File deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting file:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to delete file",
      error: error.response?.data || error.message
    });
  }
};

// Download file
const downloadFile = async (req, res) => {
  try {
    const { id } = req.params;

    // First get file info
    const fileInfo = await axios.get(`${VAPI_BASE_URL}/file/${id}`, {
      headers: {
        Authorization: `Bearer ${VAPI_SECRET_KEY}`,
        "Content-Type": "application/json"
      }
    });

    if (!fileInfo.data.url) {
      return res.status(404).json({
        success: false,
        message: "File URL not available"
      });
    }

    // Download the file
    const fileResponse = await axios.get(fileInfo.data.url, {
      responseType: 'stream'
    });

    // Set appropriate headers
    res.setHeader('Content-Type', fileInfo.data.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileInfo.data.name || 'download'}"`);

    // Pipe the file stream to response
    fileResponse.data.pipe(res);
  } catch (error) {
    console.error("Error downloading file:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      message: "Failed to download file",
      error: error.response?.data || error.message
    });
  }
};

// Get file upload limits and supported formats
const getFileInfo = async (req, res) => {
  try {
    const fileInfo = {
      maxFileSize: "50MB",
      supportedFormats: [
        "audio/mpeg",
        "audio/wav",
        "audio/mp3",
        "audio/m4a",
        "audio/ogg",
        "text/plain",
        "text/csv",
        "application/json",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ],
      uploadEndpoint: "/api/files/upload",
      maxFiles: 100
    };

    res.status(200).json({
      success: true,
      message: "File information retrieved successfully",
      data: fileInfo
    });
  } catch (error) {
    console.error("Error fetching file info:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch file information",
      error: error.message
    });
  }
};

module.exports = {
  listFiles,
  getFile,
  uploadFile: [upload.single('file'), uploadFile],
  updateFile,
  deleteFile,
  downloadFile,
  getFileInfo
};
