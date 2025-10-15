const ClinicalUserModel = require('../../model/clinicalUserModel/clinicalUserModel');

class ClinicalUserController {
  // Get all clinical users
  static async getAllClinicalUsers(req, res) {
    try {
      const users = await ClinicalUserModel.getAllClinicalUsers();
      res.status(200).json({
        success: true,
        data: users,
        message: 'Clinical users retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching clinical users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinical users',
        error: error.message
      });
    }
  }

  // Create new clinical user
  static async createClinicalUser(req, res) {
    try {
      const userData = req.body;

      // Validation
      if (!userData.name || !userData.email) {
        return res.status(400).json({
          success: false,
          message: 'Name and email are required'
        });
      }

      // Add created_by from authenticated user
      userData.created_by = req.user?.user?.id || req.user?.id;

      const user = await ClinicalUserModel.createClinicalUser(userData);
      res.status(201).json({
        success: true,
        data: user,
        message: 'Clinical user created successfully'
      });
    } catch (error) {
      console.error('Error creating clinical user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create clinical user',
        error: error.message
      });
    }
  }

  // Get clinical user by ID
  static async getClinicalUserById(req, res) {
    try {
      const { id } = req.params;
      const user = await ClinicalUserModel.getClinicalUserById(id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Clinical user not found'
        });
      }

      res.status(200).json({
        success: true,
        data: user,
        message: 'Clinical user retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching clinical user:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinical user',
        error: error.message
      });
    }
  }

  // Assign clinical role to user
  static async assignClinicalRole(req, res) {
    try {
      const { userId } = req.params;
      const roleData = req.body;
      
      // Add assigned_by from the authenticated user
      roleData.assigned_by = req.user.id;

      const user = await ClinicalUserModel.assignClinicalRole(userId, roleData);
      res.status(200).json({
        success: true,
        data: user,
        message: 'Clinical role assigned successfully'
      });
    } catch (error) {
      console.error('Error assigning clinical role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to assign clinical role',
        error: error.message
      });
    }
  }

  // Remove clinical role from user
  static async removeClinicalRole(req, res) {
    try {
      const { userId } = req.params;
      await ClinicalUserModel.removeClinicalRole(userId);
      
      res.status(200).json({
        success: true,
        message: 'Clinical role removed successfully'
      });
    } catch (error) {
      console.error('Error removing clinical role:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove clinical role',
        error: error.message
      });
    }
  }

  // Get clinical user statistics
  static async getClinicalUserStats(req, res) {
    try {
      const stats = await ClinicalUserModel.getClinicalUserStats();
      res.status(200).json({
        success: true,
        data: stats,
        message: 'Clinical user statistics retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching clinical user stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch clinical user statistics',
        error: error.message
      });
    }
  }

  // Get studies assigned to a user
  static async getUserStudies(req, res) {
    try {
      const { userId } = req.params;
      const studies = await ClinicalUserModel.getUserStudies(userId);
      
      res.status(200).json({
        success: true,
        data: studies,
        message: 'User studies retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching user studies:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch user studies',
        error: error.message
      });
    }
  }

  // Get available users (for assignment)
  static async getAvailableUsers(req, res) {
    try {
      const users = await ClinicalUserModel.getAvailableUsers();
      res.status(200).json({
        success: true,
        data: users,
        message: 'Available users retrieved successfully'
      });
    } catch (error) {
      console.error('Error fetching available users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch available users',
        error: error.message
      });
    }
  }
}

module.exports = ClinicalUserController;
