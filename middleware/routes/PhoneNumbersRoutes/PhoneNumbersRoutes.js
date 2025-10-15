const express = require("express");
const phoneNumbersController = require("../../controller/PhoneNumbersController/PhoneNumbersController");
const authMiddleware = require("../../middleware/authMiddleware");

const router = express.Router();

// List all phone numbers
router.get("/", authMiddleware, phoneNumbersController.listPhoneNumbers);

// Get phone number by ID
router.get("/:id", authMiddleware, phoneNumbersController.getPhoneNumber);

// Create phone number
router.post("/", authMiddleware, phoneNumbersController.createPhoneNumber);

// Update phone number
router.patch("/:id", authMiddleware, phoneNumbersController.updatePhoneNumber);

// Delete phone number
router.delete("/:id", authMiddleware, phoneNumbersController.deletePhoneNumber);

// Buy phone number
router.post("/buy", authMiddleware, phoneNumbersController.buyPhoneNumber);

// Search available phone numbers
router.get("/search/available", authMiddleware, phoneNumbersController.searchPhoneNumbers);

module.exports = router;
