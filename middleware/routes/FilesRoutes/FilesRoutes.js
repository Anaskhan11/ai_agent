const express = require("express");
const filesController = require("../../controller/FilesController/FilesController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all files
router.get("/", authMiddleware, filesController.listFiles);

// Get file by ID
router.get("/:id", authMiddleware, filesController.getFile);

// Upload file
router.post("/upload", authMiddleware, filesController.uploadFile);

// Update file
router.patch("/:id", authMiddleware, filesController.updateFile);

// Delete file
router.delete("/:id", authMiddleware, filesController.deleteFile);

// Download file
router.get("/:id/download", authMiddleware, filesController.downloadFile);

// Get file information
router.get("/info/limits", authMiddleware, filesController.getFileInfo);

module.exports = router;
