const express = require('express');
const router = express.Router();
const ClinicalStudyController = require('../../controller/clinicalStudyController/clinicalStudyController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/clinical-studies - Get all clinical studies
router.get('/', ClinicalStudyController.getAllStudies);

// GET /api/clinical-studies/stats - Get study statistics
router.get('/stats', ClinicalStudyController.getStudyStats);

// GET /api/clinical-studies/:id - Get study by ID
router.get('/:id', ClinicalStudyController.getStudyById);

// GET /api/clinical-studies/:id/participants - Get participants for a study
router.get('/:id/participants', ClinicalStudyController.getStudyParticipants);

// POST /api/clinical-studies - Create new study
router.post('/', ClinicalStudyController.createStudy);

// PUT /api/clinical-studies/:id - Update study
router.put('/:id', ClinicalStudyController.updateStudy);

// POST /api/clinical-studies/:id/assign-site - Assign study to site
router.post('/:id/assign-site', ClinicalStudyController.assignStudyToSite);

// DELETE /api/clinical-studies/:id - Delete study
router.delete('/:id', ClinicalStudyController.deleteStudy);

module.exports = router;
