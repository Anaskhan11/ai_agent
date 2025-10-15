const express = require('express');
const router = express.Router();
const StudyAssignmentController = require('../../controller/studyAssignmentController/studyAssignmentController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/study-assignments - Get all study assignments
router.get('/', StudyAssignmentController.getAllStudyAssignments);

// GET /api/study-assignments/stats - Get study assignment statistics
router.get('/stats', StudyAssignmentController.getStudyAssignmentStats);

// GET /api/study-assignments/study/:studyId - Get assignments for a specific study
router.get('/study/:studyId', StudyAssignmentController.getStudyAssignmentsByStudyId);

// GET /api/study-assignments/user/:userId - Get assignments for a specific user
router.get('/user/:userId', StudyAssignmentController.getStudyAssignmentsByUserId);

// GET /api/study-assignments/study/:studyId/available-users - Get available users for study assignment
router.get('/study/:studyId/available-users', StudyAssignmentController.getAvailableUsersForStudy);

// GET /api/study-assignments/:id - Get study assignment by ID
router.get('/:id', StudyAssignmentController.getStudyAssignmentById);

// POST /api/study-assignments - Create new study assignment
router.post('/', StudyAssignmentController.createStudyAssignment);

// POST /api/study-assignments/study/:studyId/bulk-assign - Bulk assign users to study
router.post('/study/:studyId/bulk-assign', StudyAssignmentController.bulkAssignUsersToStudy);

// PUT /api/study-assignments/:id - Update study assignment
router.put('/:id', StudyAssignmentController.updateStudyAssignment);

// DELETE /api/study-assignments/:id - Remove study assignment
router.delete('/:id', StudyAssignmentController.removeStudyAssignment);

module.exports = router;
