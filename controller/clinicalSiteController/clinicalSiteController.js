const ClinicalSiteModel = require('../../model/clinicalSiteModel/clinicalSiteModel');

class ClinicalSiteController {
  // Get all clinical sites
  static async getAllSites(req, res) {
    try {
      const sites = await ClinicalSiteModel.getAllSites();
      res.status(200).json({
        success: true,
        data: sites,
        message: 'Clinical sites retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching clinical sites:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinical sites',
        error: error.message
      });
    }
  }

  // Get site by ID
  static async getSiteById(req, res) {
    try {
      const { id } = req.params;
      const site = await ClinicalSiteModel.getSiteById(id);
      
      if (!site) {
        return res.status(404).json({
          success: false,
          message: 'Clinical site not found'
        });
      }

      res.status(200).json({
        success: true,
        data: site,
        message: 'Clinical site retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching clinical site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinical site',
        error: error.message
      });
    }
  }

  // Create new site
  static async createSite(req, res) {
    try {
      const siteData = req.body;
      
      // Validation
      if (!siteData.site_name || !siteData.site_code) {
        return res.status(400).json({
          success: false,
          message: 'Site name and site code are required'
        });
      }

      const site = await ClinicalSiteModel.createSite(siteData);
      res.status(201).json({
        success: true,
        data: site,
        message: 'Clinical site created successfully'
      });
    } catch (error) {
      console.error('Error creating clinical site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create clinical site',
        error: error.message
      });
    }
  }

  // Update site
  static async updateSite(req, res) {
    try {
      const { id } = req.params;
      const siteData = req.body;

      const site = await ClinicalSiteModel.updateSite(id, siteData);
      if (!site) {
        return res.status(404).json({
          success: false,
          message: 'Clinical site not found'
        });
      }

      res.status(200).json({
        success: true,
        data: site,
        message: 'Clinical site updated successfully'
      });
    } catch (error) {
      console.error('Error updating clinical site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update clinical site',
        error: error.message
      });
    }
  }

  // Delete site
  static async deleteSite(req, res) {
    try {
      const { id } = req.params;
      await ClinicalSiteModel.deleteSite(id);
      
      res.status(200).json({
        success: true,
        message: 'Clinical site deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting clinical site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete clinical site',
        error: error.message
      });
    }
  }

  // Get site statistics
  static async getSiteStats(req, res) {
    try {
      const stats = await ClinicalSiteModel.getSiteStats();
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Site statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching site stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch site statistics',
        error: error.message
      });
    }
  }

  // Get studies for a specific site
  static async getSiteStudies(req, res) {
    try {
      const { id } = req.params;
      const studies = await ClinicalSiteModel.getSiteStudies(id);
      
      res.status(200).json({
        success: true,
        data: studies,
        message: 'Site studies retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching site studies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch site studies',
        error: error.message
      });
    }
  }
}

module.exports = ClinicalSiteController;
