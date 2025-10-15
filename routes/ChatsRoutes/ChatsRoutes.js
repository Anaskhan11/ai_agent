const express = require("express");
const chatsController = require("../../controller/ChatsController/ChatsController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all chats
router.get("/", authMiddleware, chatsController.listChats);

// Get chat by ID
router.get("/:id", authMiddleware, chatsController.getChat);

// Create chat
router.post("/", authMiddleware, chatsController.createChat);

// Delete chat
router.delete("/:id", authMiddleware, chatsController.deleteChat);

// Create chat completion (OpenAI compatible)
router.post("/completions", authMiddleware, chatsController.createChatCompletion);

// Send message to chat
router.post("/:id/messages", authMiddleware, chatsController.sendMessage);

// Get chat statistics
router.get("/stats/overview", authMiddleware, chatsController.getChatStats);

module.exports = router;
