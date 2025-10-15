const express = require("express");
const phoneNumbersController = require("../../controller/PhoneNumbersController/PhoneNumbersController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkCredits } = require("../../middleware/creditMiddleware");

const router = express.Router();

// List all phone numbers
router.get("/", authMiddleware, phoneNumbersController.listPhoneNumbers);

// Get phone number by ID
router.get("/:id", authMiddleware, phoneNumbersController.getPhoneNumber);

// Create phone number (requires credits for regular users, super admin bypass)
router.post("/", authMiddleware, checkCredits('phone_number_creation', 'per_operation', 1), phoneNumbersController.createPhoneNumber);

// Update phone number
router.patch("/:id", authMiddleware, phoneNumbersController.updatePhoneNumber);

// Delete phone number
router.delete("/:id", authMiddleware, phoneNumbersController.deletePhoneNumber);

// Buy phone number (requires credits for regular users, super admin bypass)
router.post("/buy", authMiddleware, checkCredits('phone_number_purchase', 'per_operation', 1), phoneNumbersController.buyPhoneNumber);

// Import Twilio phone number (requires credits for regular users, super admin bypass)
router.post("/import/twilio", authMiddleware, checkCredits('phone_number_creation', 'per_operation', 1), phoneNumbersController.importTwilioPhoneNumber);

// Search available phone numbers
router.get("/search/available", authMiddleware, phoneNumbersController.searchPhoneNumbers);

// Super Admin Routes - Phone Number Assignment
router.get("/admin/all", authMiddleware, phoneNumbersController.getAllPhoneNumbersForAdmin);
router.get("/admin/vapi-all", authMiddleware, phoneNumbersController.getAllVapiPhoneNumbersForAdmin);
router.post("/:id/assign", authMiddleware, phoneNumbersController.assignPhoneNumberToUser);
router.post("/:id/unassign", authMiddleware, phoneNumbersController.unassignPhoneNumber);

// Debug routes - show all phone numbers with assignments (temporary)
router.get("/debug/assignments", authMiddleware, phoneNumbersController.debugPhoneNumberAssignments);
router.get("/debug/user-numbers", authMiddleware, phoneNumbersController.debugUserPhoneNumbers);

module.exports = router;
