const pool = require('../../config/DBConnection');

class ClinicalUserModel {
  static async getAllClinicalUsers() {
    try {
      const [rows] = await pool.execute(`
        SELECT
          u.id,
          u.username,
          u.email,
          u.phone_number as phone,
          u.first_name,
          u.last_name,
          u.created_at,
          u.last_login,
          cr.name as clinical_role_name,
          cr.display_name as clinical_role_display,
          s.site_name,
          COUNT(DISTINCT st.id) as assigned_studies
        FROM users u
        LEFT JOIN user_clinical_roles ucr ON u.id = ucr.user_id AND ucr.is_active = 1
        LEFT JOIN clinical_roles cr ON ucr.clinical_role_id = cr.id
        LEFT JOIN sites s ON ucr.site_id = s.id
        LEFT JOIN studies st ON (st.principal_investigator_id = u.id) AND st.is_active = 1
        WHERE ucr.user_id IS NOT NULL
        GROUP BY u.id, cr.id, s.id
        ORDER BY u.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error in getAllClinicalUsers:', error);
      throw error;
    }
  }

  static async createClinicalUser(userData) {
    try {
      const {
        name,
        email,
        phone,
        clinical_role,
        clinical_site,
        created_by
      } = userData;

      // Parse name into first_name and last_name
      const nameParts = name.trim().split(' ');
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';

      // Generate username from email
      const username = email.split('@')[0];

      // Create user in users table
      const [userResult] = await pool.execute(`
        INSERT INTO users (
          username, email, first_name, last_name, phone_number,
          password_hash, role_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, [
        username,
        email,
        first_name,
        last_name,
        phone || null,
        'temp_hash', // Temporary password hash - user will need to set password
        'clinical_user', // Default role
      ]);

      const userId = userResult.insertId;

      // If clinical role is provided, assign it
      if (clinical_role) {
        // Get clinical role ID by name
        const [roleRows] = await pool.execute(`
          SELECT id FROM clinical_roles WHERE name = ? AND is_active = 1
        `, [clinical_role]);

        if (roleRows.length > 0) {
          const roleId = roleRows[0].id;

          // Assign clinical role
          await pool.execute(`
            INSERT INTO user_clinical_roles (
              user_id, clinical_role_id, site_id, assigned_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, NOW(), NOW())
          `, [
            userId,
            roleId,
            clinical_site || null,
            created_by
          ]);
        }
      }

      // Return the created user with role information
      return await this.getClinicalUserById(userId);
    } catch (error) {
      console.error('Error in createClinicalUser:', error);
      throw error;
    }
  }

  static async getClinicalUserById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT
          u.*,
          cr.name as clinical_role_name,
          cr.display_name as clinical_role_display,
          s.site_name,
          s.id as site_id
        FROM users u
        LEFT JOIN user_clinical_roles ucr ON u.id = ucr.user_id AND ucr.is_active = 1
        LEFT JOIN clinical_roles cr ON ucr.clinical_role_id = cr.id
        LEFT JOIN sites s ON ucr.site_id = s.id
        WHERE u.id = ?
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error in getClinicalUserById:', error);
      throw error;
    }
  }

  static async assignClinicalRole(userId, roleData) {
    try {
      const { clinical_role_id, site_id, assigned_by, expires_at } = roleData;

      // First, deactivate any existing clinical role assignments for this user
      await pool.execute(`
        UPDATE user_clinical_roles
        SET is_active = 0, updated_at = NOW()
        WHERE user_id = ?
      `, [userId]);

      // Then create the new assignment
      const [result] = await pool.execute(`
        INSERT INTO user_clinical_roles (
          user_id, clinical_role_id, site_id, assigned_by, assigned_at, expires_at, is_active
        ) VALUES (?, ?, ?, ?, NOW(), ?, 1)
      `, [userId, clinical_role_id, site_id, assigned_by, expires_at]);

      return await this.getClinicalUserById(userId);
    } catch (error) {
      console.error('Error in assignClinicalRole:', error);
      throw error;
    }
  }

  static async removeClinicalRole(userId) {
    try {
      await pool.execute(`
        UPDATE user_clinical_roles
        SET is_active = 0, updated_at = NOW()
        WHERE user_id = ?
      `, [userId]);
      return true;
    } catch (error) {
      console.error('Error in removeClinicalRole:', error);
      throw error;
    }
  }

  static async getClinicalUserStats() {
    try {
      const [stats] = await pool.execute(`
        SELECT
          COUNT(DISTINCT ucr.user_id) as total_clinical_users,
          COUNT(CASE WHEN cr.name = 'principal_investigator' THEN 1 END) as principal_investigators,
          COUNT(CASE WHEN cr.name = 'study_coordinator' THEN 1 END) as study_coordinators,
          COUNT(CASE WHEN cr.name = 'site_manager' THEN 1 END) as site_managers,
          COUNT(DISTINCT ucr.site_id) as sites_covered
        FROM user_clinical_roles ucr
        LEFT JOIN clinical_roles cr ON ucr.clinical_role_id = cr.id
        WHERE ucr.is_active = 1
      `);
      return stats[0];
    } catch (error) {
      console.error('Error in getClinicalUserStats:', error);
      throw error;
    }
  }

  static async getUserStudies(userId) {
    try {
      const [rows] = await pool.execute(`
        SELECT DISTINCT
          s.*,
          'No site assigned' as site_name
        FROM studies s
        LEFT JOIN user_clinical_roles ucr ON (
          s.principal_investigator_id = ? OR
          ucr.user_id = ?
        )
        WHERE s.is_active = 1 AND (
          s.principal_investigator_id = ? OR
          ucr.user_id = ?
        )
        ORDER BY s.created_at DESC
      `, [userId, userId, userId, userId]);
      return rows;
    } catch (error) {
      console.error('Error in getUserStudies:', error);
      throw error;
    }
  }

  static async getAvailableUsers() {
    try {
      const [rows] = await pool.execute(`
        SELECT
          u.id,
          u.username,
          u.email,
          u.phone_number as phone,
          u.first_name,
          u.last_name,
          u.created_at,
          CASE WHEN ucr.user_id IS NOT NULL THEN 1 ELSE 0 END as has_clinical_role
        FROM users u
        LEFT JOIN user_clinical_roles ucr ON u.id = ucr.user_id AND ucr.is_active = 1
        WHERE u.is_active = 1
        ORDER BY u.username
      `);
      return rows;
    } catch (error) {
      console.error('Error in getAvailableUsers:', error);
      throw error;
    }
  }
}

module.exports = ClinicalUserModel;
