const express = require('express');
const router = express.Router();
const ClinicalUserController = require('../../controller/clinicalUserController/clinicalUserController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/clinical-users - Get all clinical users
router.get('/', ClinicalUserController.getAllClinicalUsers);

// GET /api/clinical-users/stats - Get clinical user statistics
router.get('/stats', ClinicalUserController.getClinicalUserStats);

// GET /api/clinical-users/available - Get available users for assignment
router.get('/available', ClinicalUserController.getAvailableUsers);

// POST /api/clinical-users - Create new clinical user
router.post('/', ClinicalUserController.createClinicalUser);

// GET /api/clinical-users/:id - Get clinical user by ID
router.get('/:id', ClinicalUserController.getClinicalUserById);

// GET /api/clinical-users/:userId/studies - Get studies for a user
router.get('/:userId/studies', ClinicalUserController.getUserStudies);

// POST /api/clinical-users/:userId/assign-role - Assign clinical role to user
router.post('/:userId/assign-role', ClinicalUserController.assignClinicalRole);

// DELETE /api/clinical-users/:userId/remove-role - Remove clinical role from user
router.delete('/:userId/remove-role', ClinicalUserController.removeClinicalRole);

module.exports = router;
