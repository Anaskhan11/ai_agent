const express = require('express');
const router = express.Router();
const ClinicalSiteController = require('../../controller/clinicalSiteController/clinicalSiteController');
const authMiddleware = require('../../middleware/authMiddleware');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/clinical-sites - Get all clinical sites
router.get('/', ClinicalSiteController.getAllSites);

// GET /api/clinical-sites/stats - Get site statistics
router.get('/stats', ClinicalSiteController.getSiteStats);

// GET /api/clinical-sites/:id - Get site by ID
router.get('/:id', ClinicalSiteController.getSiteById);

// GET /api/clinical-sites/:id/studies - Get studies for a site
router.get('/:id/studies', ClinicalSiteController.getSiteStudies);

// POST /api/clinical-sites - Create new site
router.post('/', ClinicalSiteController.createSite);

// PUT /api/clinical-sites/:id - Update site
router.put('/:id', ClinicalSiteController.updateSite);

// DELETE /api/clinical-sites/:id - Delete site
router.delete('/:id', ClinicalSiteController.deleteSite);

module.exports = router;
