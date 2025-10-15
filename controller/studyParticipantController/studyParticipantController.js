const StudyParticipantModel = require('../../model/studyParticipantModel/studyParticipantModel');

class StudyParticipantController {
  // Get all study participants
  static async getAllParticipants(req, res) {
    try {
      const participants = await StudyParticipantModel.getAllParticipants();
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

  // Get participant by ID
  static async getParticipantById(req, res) {
    try {
      const { id } = req.params;
      const participant = await StudyParticipantModel.getParticipantById(id);
      
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'Study participant not found'
        });
      }

      res.status(200).json({
        success: true,
        data: participant,
        message: 'Study participant retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study participant:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch study participant',
        error: error.message
      });
    }
  }

  // Enroll new participant
  static async enrollParticipant(req, res) {
    try {
      const participantData = req.body;
      
      // Validation
      if (!participantData.study_id || !participantData.patient_id) {
        return res.status(400).json({
          success: false,
          message: 'Study ID and Patient ID are required'
        });
      }

      const participant = await StudyParticipantModel.enrollParticipant(participantData);
      res.status(201).json({
        success: true,
        data: participant,
        message: 'Participant enrolled successfully'
      });
    } catch (error) {
      console.error('Error enrolling participant:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to enroll participant',
        error: error.message
      });
    }
  }

  // Update participant
  static async updateParticipant(req, res) {
    try {
      const { id } = req.params;
      const participantData = req.body;

      const participant = await StudyParticipantModel.updateParticipant(id, participantData);
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'Study participant not found'
        });
      }

      res.status(200).json({
        success: true,
        data: participant,
        message: 'Participant updated successfully'
      });
    } catch (error) {
      console.error('Error updating participant:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update participant',
        error: error.message
      });
    }
  }

  // Remove participant
  static async removeParticipant(req, res) {
    try {
      const { id } = req.params;
      await StudyParticipantModel.removeParticipant(id);
      
      res.status(200).json({
        success: true,
        message: 'Participant removed successfully'
      });
    } catch (error) {
      console.error('Error removing participant:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove participant',
        error: error.message
      });
    }
  }

  // Get participant statistics
  static async getParticipantStats(req, res) {
    try {
      const stats = await StudyParticipantModel.getParticipantStats();
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Participant statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching participant stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch participant statistics',
        error: error.message
      });
    }
  }

  // Get available patients for enrollment
  static async getAvailablePatients(req, res) {
    try {
      const patients = await StudyParticipantModel.getAvailablePatients();
      res.status(200).json({
        success: true,
        data: patients,
        message: 'Available patients retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching available patients:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available patients',
        error: error.message
      });
    }
  }

  // Get participants by study
  static async getParticipantsByStudy(req, res) {
    try {
      const { studyId } = req.params;
      const participants = await StudyParticipantModel.getStudyParticipantsByStudy(studyId);
      
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

module.exports = StudyParticipantController;
