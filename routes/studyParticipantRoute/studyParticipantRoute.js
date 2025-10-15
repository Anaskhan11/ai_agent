const express = require('express');
const router = express.Router();
const StudyParticipantController = require('../../controller/studyParticipantController/studyParticipantController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/study-participants - Get all study participants
router.get('/', StudyParticipantController.getAllParticipants);

// GET /api/study-participants/stats - Get participant statistics
router.get('/stats', StudyParticipantController.getParticipantStats);

// GET /api/study-participants/available-patients - Get available patients for enrollment
router.get('/available-patients', StudyParticipantController.getAvailablePatients);

// GET /api/study-participants/:id - Get participant by ID
router.get('/:id', StudyParticipantController.getParticipantById);

// GET /api/study-participants/study/:studyId - Get participants by study
router.get('/study/:studyId', StudyParticipantController.getParticipantsByStudy);

// POST /api/study-participants - Enroll new participant
router.post('/', StudyParticipantController.enrollParticipant);

// PUT /api/study-participants/:id - Update participant
router.put('/:id', StudyParticipantController.updateParticipant);

// DELETE /api/study-participants/:id - Remove participant
router.delete('/:id', StudyParticipantController.removeParticipant);

module.exports = router;
