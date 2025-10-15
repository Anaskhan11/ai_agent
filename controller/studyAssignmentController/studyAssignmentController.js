const StudyAssignmentModel = require('../../model/studyAssignmentModel/studyAssignmentModel');

class StudyAssignmentController {
  // Get all study assignments
  static async getAllStudyAssignments(req, res) {
    try {
      const assignments = await StudyAssignmentModel.getAllStudyAssignments();
      res.status(200).json({
        success: true,
        data: assignments,
        message: 'Study assignments retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study assignments:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch study assignments',
        error: error.message
      });
    }
  }

  // Get study assignments by study ID
  static async getStudyAssignmentsByStudyId(req, res) {
    try {
      const { studyId } = req.params;
      const assignments = await StudyAssignmentModel.getStudyAssignmentsByStudyId(studyId);
      res.status(200).json({
        success: true,
        data: assignments,
        message: 'Study assignments retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study assignments by study ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch study assignments',
        error: error.message
      });
    }
  }

  // Get study assignments by user ID
  static async getStudyAssignmentsByUserId(req, res) {
    try {
      const { userId } = req.params;
      const assignments = await StudyAssignmentModel.getStudyAssignmentsByUserId(userId);
      res.status(200).json({
        success: true,
        data: assignments,
        message: 'User study assignments retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study assignments by user ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user study assignments',
        error: error.message
      });
    }
  }

  // Create study assignment
  static async createStudyAssignment(req, res) {
    try {
      const assignmentData = req.body;
      const assignedBy = req.user?.user?.id || req.user?.id;

      // Validation
      if (!assignmentData.study_id || !assignmentData.user_id || !assignmentData.clinical_role_id) {
        return res.status(400).json({
          success: false,
          message: 'Study ID, User ID, and Clinical Role ID are required'
        });
      }

      assignmentData.assigned_by = assignedBy;
      const assignment = await StudyAssignmentModel.createStudyAssignment(assignmentData);
      
      res.status(201).json({
        success: true,
        data: assignment,
        message: 'Study assignment created successfully'
      });
    } catch (error) {
      console.error('Error creating study assignment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create study assignment',
        error: error.message
      });
    }
  }

  // Get study assignment by ID
  static async getStudyAssignmentById(req, res) {
    try {
      const { id } = req.params;
      const assignment = await StudyAssignmentModel.getStudyAssignmentById(id);
      
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Study assignment not found'
        });
      }

      res.status(200).json({
        success: true,
        data: assignment,
        message: 'Study assignment retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study assignment by ID:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch study assignment',
        error: error.message
      });
    }
  }

  // Update study assignment
  static async updateStudyAssignment(req, res) {
    try {
      const { id } = req.params;
      const assignmentData = req.body;

      const assignment = await StudyAssignmentModel.updateStudyAssignment(id, assignmentData);
      if (!assignment) {
        return res.status(404).json({
          success: false,
          message: 'Study assignment not found'
        });
      }

      res.status(200).json({
        success: true,
        data: assignment,
        message: 'Study assignment updated successfully'
      });
    } catch (error) {
      console.error('Error updating study assignment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update study assignment',
        error: error.message
      });
    }
  }

  // Remove study assignment
  static async removeStudyAssignment(req, res) {
    try {
      const { id } = req.params;
      const removed = await StudyAssignmentModel.removeStudyAssignment(id);
      
      if (!removed) {
        return res.status(404).json({
          success: false,
          message: 'Study assignment not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Study assignment removed successfully'
      });
    } catch (error) {
      console.error('Error removing study assignment:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove study assignment',
        error: error.message
      });
    }
  }

  // Get study assignment statistics
  static async getStudyAssignmentStats(req, res) {
    try {
      const stats = await StudyAssignmentModel.getStudyAssignmentStats();
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Study assignment statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching study assignment stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch study assignment statistics',
        error: error.message
      });
    }
  }

  // Get available users for study assignment
  static async getAvailableUsersForStudy(req, res) {
    try {
      const { studyId } = req.params;
      const users = await StudyAssignmentModel.getAvailableUsersForStudy(studyId);
      res.status(200).json({
        success: true,
        data: users,
        message: 'Available users for study retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching available users for study:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available users for study',
        error: error.message
      });
    }
  }

  // Bulk assign users to study
  static async bulkAssignUsersToStudy(req, res) {
    try {
      const { studyId } = req.params;
      const { assignments } = req.body;
      const assignedBy = req.user?.user?.id || req.user?.id;

      if (!assignments || !Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Assignments array is required and must not be empty'
        });
      }

      const results = await StudyAssignmentModel.bulkAssignUsersToStudy(studyId, assignments, assignedBy);
      
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      res.status(200).json({
        success: true,
        data: {
          results,
          summary: {
            total: results.length,
            successful: successCount,
            failed: failureCount
          }
        },
        message: `Bulk assignment completed: ${successCount} successful, ${failureCount} failed`
      });
    } catch (error) {
      console.error('Error in bulk assign users to study:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk assign users to study',
        error: error.message
      });
    }
  }
}

module.exports = StudyAssignmentController;
