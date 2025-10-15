const express = require('express');
const router = express.Router();
const patientLeadController = require('../../controller/patientLeadController/patientLeadController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Patient Lead Management Routes

// GET /api/patient-leads - Get all patient leads with filtering and pagination
router.get('/', patientLeadController.getAllPatientLeads);

// GET /api/patient-leads/stats - Get patient lead statistics
router.get('/stats', patientLeadController.getPatientLeadStats);

// GET /api/patient-leads/available-for-study - Get patients available for study enrollment
router.get('/available-for-study', patientLeadController.getAvailablePatientsForStudy);

// GET /api/patient-leads/:id - Get patient lead by ID
router.get('/:id', patientLeadController.getPatientLeadById);

// POST /api/patient-leads - Create initial patient lead (from webhook/contact)
router.post('/', patientLeadController.createPatientLead);

// PUT /api/patient-leads/:id/extended-form - Update patient with extended form data
router.put('/:id/extended-form', patientLeadController.updatePatientExtendedForm);

// PUT /api/patient-leads/:id/status - Update patient status
router.put('/:id/status', patientLeadController.updatePatientStatus);

// POST /api/patient-leads/:id/enroll - Enroll patient in study
router.post('/:id/enroll', patientLeadController.enrollPatientInStudy);

module.exports = router;
