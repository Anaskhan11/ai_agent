const pool = require('../../config/DBConnection');

class StudyParticipantModel {
  static async getAllParticipants() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          sp.*,
          p.name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone,
          s.study_name,
          s.study_code,
          st.site_name,
          u.username as pi_name
        FROM study_participants sp
        LEFT JOIN patients p ON sp.patient_id = p.id
        LEFT JOIN studies s ON sp.study_id = s.id
        LEFT JOIN sites st ON s.site_id = st.id
        LEFT JOIN users u ON s.principal_investigator_id = u.id
        WHERE sp.is_active = 1
        ORDER BY sp.enrollment_date DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error fetching study participants:', error);
      throw error;
    }
  }

  static async getParticipantById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          sp.*,
          p.name as patient_name,
          p.email as patient_email,
          p.phone as patient_phone,
          s.study_name,
          s.study_code,
          st.site_name,
          u.username as pi_name
        FROM study_participants sp
        LEFT JOIN patients p ON sp.patient_id = p.id
        LEFT JOIN studies s ON sp.study_id = s.id
        LEFT JOIN sites st ON s.site_id = st.id
        LEFT JOIN users u ON s.principal_investigator_id = u.id
        WHERE sp.id = ? AND sp.is_active = 1
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error fetching study participant by ID:', error);
      throw error;
    }
  }

  static async enrollParticipant(participantData) {
    try {
      const {
        study_id,
        patient_id,
        participant_id,
        enrollment_status = 'screening',
        notes
      } = participantData;

      const [result] = await pool.execute(`
        INSERT INTO study_participants (
          study_id, patient_id, participant_id, enrollment_date, enrollment_status,
          notes, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, NOW(), ?, ?, 1, NOW(), NOW())
      `, [study_id, patient_id, participant_id, enrollment_status, notes]);

      return await this.getParticipantById(result.insertId);
    } catch (error) {
      console.error('Error enrolling participant:', error);
      throw error;
    }
  }

  static async updateParticipant(id, participantData) {
    try {
      const {
        enrollment_status,
        withdrawal_reason,
        completion_date,
        notes
      } = participantData;

      await pool.execute(`
        UPDATE study_participants SET
          enrollment_status = ?, withdrawal_reason = ?, completion_date = ?,
          notes = ?, updated_at = NOW()
        WHERE id = ? AND is_active = 1
      `, [enrollment_status, withdrawal_reason, completion_date, notes, id]);

      return await this.getParticipantById(id);
    } catch (error) {
      console.error('Error updating participant:', error);
      throw error;
    }
  }

  static async removeParticipant(id) {
    try {
      await pool.execute(`
        UPDATE study_participants SET is_active = 0, updated_at = NOW() WHERE id = ?
      `, [id]);
      return true;
    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  static async getParticipantStats() {
    try {
      const [stats] = await pool.execute(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN enrollment_status = 'screening' THEN 1 END) as screening,
          COUNT(CASE WHEN enrollment_status = 'enrolled' THEN 1 END) as enrolled,
          COUNT(CASE WHEN enrollment_status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN enrollment_status = 'withdrawn' THEN 1 END) as withdrawn,
          COUNT(CASE WHEN enrollment_status = 'screen_failed' THEN 1 END) as screen_failed
        FROM study_participants
        WHERE is_active = 1
      `);
      return stats[0];
    } catch (error) {
      console.error('Error fetching participant stats:', error);
      throw error;
    }
  }

  static async getAvailablePatients() {
    try {
      const [rows] = await pool.execute(`
        SELECT
          p.*,
          CASE WHEN sp.patient_id IS NOT NULL THEN 1 ELSE 0 END as is_enrolled
        FROM patients p
        LEFT JOIN study_participants sp ON p.id = sp.patient_id AND sp.is_active = 1
        WHERE p.is_active = 1
        ORDER BY p.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error fetching available patients:', error);
      throw error;
    }
  }

  static async getStudyParticipantsByStudy(studyId) {
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
      console.error('Error fetching study participants by study:', error);
      throw error;
    }
  }
}

module.exports = StudyParticipantModel;
