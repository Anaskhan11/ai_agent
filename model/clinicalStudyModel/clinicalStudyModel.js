const pool = require('../../config/DBConnection');

class ClinicalStudyModel {
  static async getAllStudies() {
    try {
      const [rows] = await pool.execute(`
        SELECT
          s.*,
          u.username as pi_name,
          COUNT(DISTINCT sp.id) as participant_count,
          COUNT(CASE WHEN sp.enrollment_status = 'enrolled' THEN 1 END) as enrolled_count,
          COUNT(CASE WHEN sp.enrollment_status = 'screening' THEN 1 END) as screening_count
        FROM studies s
        LEFT JOIN users u ON s.principal_investigator_id = u.id
        LEFT JOIN study_participants sp ON s.id = sp.study_id AND sp.is_active = 1
        WHERE s.is_active = 1
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error in getAllStudies:', error);
      throw error;
    }
  }

  static async getStudyById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT
          s.*,
          u.username as pi_name,
          COUNT(DISTINCT sp.id) as participant_count
        FROM studies s
        LEFT JOIN users u ON s.principal_investigator_id = u.id
        LEFT JOIN study_participants sp ON s.id = sp.study_id AND sp.is_active = 1
        WHERE s.id = ? AND s.is_active = 1
        GROUP BY s.id
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error in getStudyById:', error);
      throw error;
    }
  }

  static async createStudy(studyData) {
    try {
      const {
        name,
        study_id,
        description = null,
        principal_investigator_id = null,
        study_type = 'interventional',
        phase = 'not_applicable',
        target_enrollment = 0,
        start_date = null,
        end_date = null,
        protocol_number = null,
        status = 'not_yet_recruiting',
        created_by
      } = studyData;

      const [result] = await pool.execute(`
        INSERT INTO studies (
          study_id, name, description, principal_investigator_id,
          study_type, phase, target_enrollment, start_date, end_date,
          protocol_number, status, is_active, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, NOW(), NOW())
      `, [
        study_id,
        name,
        description,
        principal_investigator_id || null,
        study_type,
        phase,
        target_enrollment || 0,
        start_date || null,
        end_date || null,
        protocol_number,
        status,
        created_by
      ]);

      return await this.getStudyById(result.insertId);
    } catch (error) {
      console.error('Error in createStudy:', error);
      throw error;
    }
  }

  static async updateStudy(id, studyData) {
    try {
      const {
        study_name,
        study_code,
        description,
        site_id,
        principal_investigator_id,
        study_type,
        phase,
        target_enrollment,
        start_date,
        end_date,
        protocol_number,
        status
      } = studyData;

      await pool.execute(`
        UPDATE studies SET
          study_name = ?, study_code = ?, description = ?, site_id = ?,
          principal_investigator_id = ?, study_type = ?, phase = ?,
          target_enrollment = ?, start_date = ?, end_date = ?,
          protocol_number = ?, status = ?, updated_at = NOW()
        WHERE id = ? AND is_active = 1
      `, [
        study_name, study_code, description, site_id, principal_investigator_id,
        study_type, phase, target_enrollment, start_date, end_date,
        protocol_number, status, id
      ]);

      return await this.getStudyById(id);
    } catch (error) {
      console.error('Error in updateStudy:', error);
      throw error;
    }
  }

  static async deleteStudy(id) {
    try {
      await pool.execute(`
        UPDATE studies SET is_active = 0, updated_at = NOW() WHERE id = ?
      `, [id]);
      return true;
    } catch (error) {
      console.error('Error in deleteStudy:', error);
      throw error;
    }
  }

  static async getStudyStats() {
    try {
      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_studies,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active_studies,
          COUNT(CASE WHEN status = 'recruiting' THEN 1 END) as recruiting_studies,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_studies,
          SUM(target_enrollment) as total_target_enrollment,
          (SELECT COUNT(*) FROM study_participants WHERE is_active = 1) as total_participants
        FROM studies
        WHERE is_active = 1
      `);
      return stats[0];
    } catch (error) {
      console.error('Error in getStudyStats:', error);
      throw error;
    }
  }

  static async getStudyParticipants(studyId) {
    try {
      const [rows] = await pool.execute(`
        SELECT
          sp.*,
          p.name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone
        FROM study_participants sp
        LEFT JOIN patients p ON sp.patient_id = p.id
        WHERE sp.study_id = ? AND sp.is_active = 1
        ORDER BY sp.enrollment_date DESC
      `, [studyId]);
      return rows;
    } catch (error) {
      console.error('Error in getStudyParticipants:', error);
      throw error;
    }
  }

  static async assignToSite(studyId, siteId, notes = null) {
    try {
      // Update the study to assign it to the site
      await pool.execute(`
        UPDATE studies
        SET site_id = ?,
            updated_at = NOW()
        WHERE id = ? AND is_active = 1
      `, [siteId, studyId]);

      // Return the updated study
      return await this.getStudyById(studyId);
    } catch (error) {
      console.error('Error in assignToSite:', error);
      throw error;
    }
  }
}

module.exports = ClinicalStudyModel;
