const express = require("express");
const router = express.Router();
const contactController = require("../../controller/contactController/contactController");
const authMiddleware = require("../../middleware/authMiddleware");
const { checkCredits } = require("../../middleware/creditMiddleware");

// Existing contact routes
router.get("/contacts", authMiddleware, contactController.getAllContacts);
router.get("/contacts/lists", authMiddleware, contactController.getListNamesWithContactCount);
router.get("/contact/:id", authMiddleware, contactController.getContactById);
router.post("/contacts", authMiddleware, checkCredits('contact_creation', 'per_operation', 1), contactController.createContacts); // For multiple contacts
router.put("/contacts/:id", authMiddleware, contactController.updateContact);
router.patch("/contacts/:id", authMiddleware, contactController.updateContactById);
router.delete("/contacts/:id", authMiddleware, contactController.deleteContact);
router.get("/contacts/:list_name/:page", contactController.getContactsByList);

// Enhanced patient management routes
router.get("/patients/stats", authMiddleware, contactController.getPatientStats);
router.get("/patients/search", authMiddleware, contactController.searchPatients);
router.post("/patients", authMiddleware, checkCredits('contact_creation', 'per_operation', 1), contactController.createPatient);
router.patch("/patients/:id/age", authMiddleware, contactController.updatePatientAge);

module.exports = router;
