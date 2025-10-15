const ClinicalStudyModel = require('../../model/clinicalStudyModel/clinicalStudyModel');

class ClinicalStudyController {
  // Get all clinical studies
  static async getAllStudies(req, res) {
    try {
      const studies = await ClinicalStudyModel.getAllStudies();
      res.status(200).json({
        success: true,
        data: studies,
        message: 'Clinical studies retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching clinical studies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinical studies',
        error: error.message
      });
    }
  }

  // Get study by ID
  static async getStudyById(req, res) {
    try {
      const { id } = req.params;
      const study = await ClinicalStudyModel.getStudyById(id);
      
      if (!study) {
        return res.status(404).json({
          success: false,
          message: 'Clinical study not found'
        });
      }

      res.status(200).json({
        success: true,
        data: study,
        message: 'Clinical study retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching clinical study:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinical study',
        error: error.message
      });
    }
  }

  // Create new study
  static async createStudy(req, res) {
    try {
      const studyData = req.body;

      // Validation
      if (!studyData.name || !studyData.study_id) {
        return res.status(400).json({
          success: false,
          message: 'Study name and study ID are required'
        });
      }

      // Add created_by from authenticated user
      studyData.created_by = req.user?.user?.id || req.user?.id;

      const study = await ClinicalStudyModel.createStudy(studyData);
      res.status(201).json({
        success: true,
        data: study,
        message: 'Clinical study created successfully'
      });
    } catch (error) {
      console.error('Error creating clinical study:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create clinical study',
        error: error.message
      });
    }
  }

  // Update study
  static async updateStudy(req, res) {
    try {
      const { id } = req.params;
      const studyData = req.body;

      const study = await ClinicalStudyModel.updateStudy(id, studyData);
      if (!study) {
        return res.status(404).json({
          success: false,
          message: 'Clinical study not found'
        });
      }

      res.status(200).json({
        success: true,
        data: study,
        message: 'Clinical study updated successfully'
      });
    } catch (error) {
      console.error('Error updating clinical study:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update clinical study',
        error: error.message
      });
    }
  }

  // Assign study to site
  static async assignStudyToSite(req, res) {
    try {
      const { id } = req.params;
      const { site_id, notes } = req.body;

      // Validation
      if (!site_id) {
        return res.status(400).json({
          success: false,
          message: 'Site ID is required'
        });
      }

      const study = await ClinicalStudyModel.assignToSite(id, site_id, notes);
      if (!study) {
        return res.status(404).json({
          success: false,
          message: 'Clinical study not found'
        });
      }

      res.status(200).json({
        success: true,
        data: study,
        message: 'Study assigned to site successfully'
      });
    } catch (error) {
      console.error('Error assigning study to site:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign study to site',
        error: error.message
      });
    }
  }

  // Delete study
  static async deleteStudy(req, res) {
    try {
      const { id } = req.params;
      await ClinicalStudyModel.deleteStudy(id);

      res.status(200).json({
        success: true,
        message: 'Clinical study deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting clinical study:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete clinical study',
        error: error.message
      });
    }
  }

  // Get study statistics
  static async getStudyStats(req, res) {
    try {
      const stats = await ClinicalStudyModel.getStudyStats();
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Study statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch study statistics',
        error: error.message
      });
    }
  }

  // Get participants for a specific study
  static async getStudyParticipants(req, res) {
    try {
      const { id } = req.params;
      const participants = await ClinicalStudyModel.getStudyParticipants(id);
      
      res.status(200).json({
        success: true,
        data: participants,
        message: 'Study participants retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study participants:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch study participants',
        error: error.message
      });
    }
  }
}

module.exports = ClinicalStudyController;
