const pool = require('../../config/DBConnection');

class StudyAssignmentModel {
  // Get all study assignments
  static async getAllStudyAssignments() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          sa.*,
          s.name as study_name,
          s.study_id as study_code,
          s.protocol_number,
          u.username as user_name,
          u.email as user_email,
          cr.display_name as role_name,
          cr.name as role_code,
          assigned_user.username as assigned_by_name
        FROM study_assignments sa
        LEFT JOIN studies s ON sa.study_id = s.id
        LEFT JOIN users u ON sa.user_id = u.id
        LEFT JOIN clinical_roles cr ON sa.clinical_role_id = cr.id
        LEFT JOIN users assigned_user ON sa.assigned_by = assigned_user.id
        WHERE sa.is_active = 1
        ORDER BY sa.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error in getAllStudyAssignments:', error);
      throw error;
    }
  }

  // Get study assignments by study ID
  static async getStudyAssignmentsByStudyId(studyId) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          sa.*,
          u.username as user_name,
          u.email as user_email,
          cr.display_name as role_name,
          cr.name as role_code,
          assigned_user.username as assigned_by_name
        FROM study_assignments sa
        LEFT JOIN users u ON sa.user_id = u.id
        LEFT JOIN clinical_roles cr ON sa.clinical_role_id = cr.id
        LEFT JOIN users assigned_user ON sa.assigned_by = assigned_user.id
        WHERE sa.study_id = ? AND sa.is_active = 1
        ORDER BY cr.hierarchy_level DESC, sa.created_at DESC
      `, [studyId]);
      return rows;
    } catch (error) {
      console.error('Error in getStudyAssignmentsByStudyId:', error);
      throw error;
    }
  }

  // Get study assignments by user ID
  static async getStudyAssignmentsByUserId(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          sa.*,
          s.name as study_name,
          s.study_id as study_code,
          s.protocol_number,
          s.status as study_status,
          cr.display_name as role_name,
          cr.name as role_code,
          assigned_user.username as assigned_by_name
        FROM study_assignments sa
        LEFT JOIN studies s ON sa.study_id = s.id
        LEFT JOIN clinical_roles cr ON sa.clinical_role_id = cr.id
        LEFT JOIN users assigned_user ON sa.assigned_by = assigned_user.id
        WHERE sa.user_id = ? AND sa.is_active = 1
        ORDER BY sa.created_at DESC
      `, [userId]);
      return rows;
    } catch (error) {
      console.error('Error in getStudyAssignmentsByUserId:', error);
      throw error;
    }
  }

  // Create study assignment
  static async createStudyAssignment(assignmentData) {
    try {
      const {
        study_id,
        user_id,
        clinical_role_id,
        assignment_date = new Date().toISOString().split('T')[0],
        assigned_by
      } = assignmentData;

      // Check if assignment already exists
      const [existing] = await pool.execute(`
        SELECT id FROM study_assignments 
        WHERE study_id = ? AND user_id = ? AND clinical_role_id = ? AND is_active = 1
      `, [study_id, user_id, clinical_role_id]);

      if (existing.length > 0) {
        throw new Error('User is already assigned to this study with this role');
      }

      const [result] = await pool.execute(`
        INSERT INTO study_assignments (
          study_id, user_id, clinical_role_id, assignment_date, assigned_by, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())
      `, [study_id, user_id, clinical_role_id, assignment_date, assigned_by]);

      return await this.getStudyAssignmentById(result.insertId);
    } catch (error) {
      console.error('Error in createStudyAssignment:', error);
      throw error;
    }
  }

  // Get study assignment by ID
  static async getStudyAssignmentById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          sa.*,
          s.name as study_name,
          s.study_id as study_code,
          s.protocol_number,
          u.username as user_name,
          u.email as user_email,
          cr.display_name as role_name,
          cr.name as role_code,
          assigned_user.username as assigned_by_name
        FROM study_assignments sa
        LEFT JOIN studies s ON sa.study_id = s.id
        LEFT JOIN users u ON sa.user_id = u.id
        LEFT JOIN clinical_roles cr ON sa.clinical_role_id = cr.id
        LEFT JOIN users assigned_user ON sa.assigned_by = assigned_user.id
        WHERE sa.id = ? AND sa.is_active = 1
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error in getStudyAssignmentById:', error);
      throw error;
    }
  }

  // Update study assignment
  static async updateStudyAssignment(id, assignmentData) {
    try {
      const {
        clinical_role_id,
        assignment_date,
        is_active = 1
      } = assignmentData;

      await pool.execute(`
        UPDATE study_assignments SET
          clinical_role_id = ?, assignment_date = ?, is_active = ?, updated_at = NOW()
        WHERE id = ?
      `, [clinical_role_id, assignment_date, is_active, id]);

      return await this.getStudyAssignmentById(id);
    } catch (error) {
      console.error('Error in updateStudyAssignment:', error);
      throw error;
    }
  }

  // Remove study assignment (soft delete)
  static async removeStudyAssignment(id) {
    try {
      await pool.execute(`
        UPDATE study_assignments SET is_active = 0, updated_at = NOW() WHERE id = ?
      `, [id]);
      return true;
    } catch (error) {
      console.error('Error in removeStudyAssignment:', error);
      throw error;
    }
  }

  // Get study assignment statistics
  static async getStudyAssignmentStats() {
    try {
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_assignments,
          COUNT(DISTINCT study_id) as studies_with_assignments,
          COUNT(DISTINCT user_id) as users_with_assignments,
          COUNT(DISTINCT clinical_role_id) as roles_assigned
        FROM study_assignments
        WHERE is_active = 1
      `);
      return stats[0];
    } catch (error) {
      console.error('Error in getStudyAssignmentStats:', error);
      throw error;
    }
  }

  // Get available users for study assignment (users with clinical roles)
  static async getAvailableUsersForStudy(studyId) {
    try {
      const [rows] = await pool.execute(`
        SELECT DISTINCT
          u.id,
          u.username,
          u.email,
          u.first_name,
          u.last_name,
          cr.id as clinical_role_id,
          cr.display_name as role_name,
          cr.name as role_code
        FROM users u
        INNER JOIN user_clinical_roles ucr ON u.id = ucr.user_id
        INNER JOIN clinical_roles cr ON ucr.clinical_role_id = cr.id
        WHERE ucr.is_active = 1 
          AND cr.is_active = 1
          AND u.id NOT IN (
            SELECT user_id FROM study_assignments 
            WHERE study_id = ? AND is_active = 1
          )
        ORDER BY cr.hierarchy_level DESC, u.username ASC
      `, [studyId]);
      return rows;
    } catch (error) {
      console.error('Error in getAvailableUsersForStudy:', error);
      throw error;
    }
  }

  // Bulk assign users to study
  static async bulkAssignUsersToStudy(studyId, assignments, assignedBy) {
    try {
      const results = [];
      
      for (const assignment of assignments) {
        const { user_id, clinical_role_id } = assignment;
        
        const assignmentData = {
          study_id: studyId,
          user_id,
          clinical_role_id,
          assigned_by: assignedBy
        };
        
        try {
          const result = await this.createStudyAssignment(assignmentData);
          results.push({ success: true, assignment: result });
        } catch (error) {
          results.push({ 
            success: false, 
            error: error.message,
            user_id,
            clinical_role_id
          });
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error in bulkAssignUsersToStudy:', error);
      throw error;
    }
  }
}

module.exports = StudyAssignmentModel;
