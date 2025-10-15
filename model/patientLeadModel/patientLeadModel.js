const pool = require('../../config/DBConnection');

class PatientLeadModel {
  // Encrypt sensitive data (simplified for now - stores as plain text in buffer)
  static encrypt(text) {
    if (!text) return null;
    return Buffer.from(text, 'utf8');
  }

  // Decrypt sensitive data (simplified for now)
  static decrypt(encryptedBuffer) {
    if (!encryptedBuffer) return null;
    return encryptedBuffer.toString('utf8');
  }

  // Create initial patient lead (3 basic fields from webhook/contact)
  static async createPatientLead(leadData) {
    try {
      const {
        first_name,
        last_name,
        email,
        phone,
        patient_lead_source = 'webhook',
        patient_lead_owner_id,
        study_id
      } = leadData;

      const patient_id = `PAT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const [result] = await pool.execute(`
        INSERT INTO patients (
          patient_id,
          study_id,
          first_name_encrypted,
          last_name_encrypted,
          email_encrypted,
          phone_encrypted,
          patient_lead_source,
          patient_lead_owner_id,
          patient_status,
          qualified_status,
          recruitment_status,
          lead_created_at,
          is_active,
          created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'lead', 'pending', 'identified', NOW(), 1, ?)
      `, [
        patient_id,
        study_id,
        this.encrypt(first_name),
        this.encrypt(last_name),
        this.encrypt(email),
        this.encrypt(phone),
        patient_lead_source,
        patient_lead_owner_id,
        patient_lead_owner_id || 1
      ]);

      return await this.getPatientLeadById(result.insertId);
    } catch (error) {
      console.error('Error in createPatientLead:', error);
      throw error;
    }
  }

  // Update patient with extended form data (19 additional fields)
  static async updatePatientExtendedForm(patientId, extendedData) {
    try {
      const {
        patient_lead_name,
        phone_2,
        date_of_birth,
        age,
        height,
        weight_lbs,
        habits,
        medications,
        diagnosis,
        surgeries,
        banned = false,
        qualified_status = 'pending',
        not_interested_reasons
      } = extendedData;

      await pool.execute(`
        UPDATE patients SET
          patient_lead_name = ?,
          phone_2_encrypted = ?,
          date_of_birth_encrypted = ?,
          age = ?,
          height = ?,
          weight_lbs = ?,
          habits_encrypted = ?,
          medications_encrypted = ?,
          diagnosis_encrypted = ?,
          surgeries_encrypted = ?,
          banned = ?,
          qualified_status = ?,
          not_interested_reasons_encrypted = ?,
          extended_form_completed = 1,
          extended_form_completed_at = NOW(),
          patient_status = CASE 
            WHEN qualified_status = 'qualified' THEN 'screening'
            WHEN qualified_status = 'not_qualified' THEN 'not_interested'
            ELSE 'lead'
          END,
          recruitment_status = CASE 
            WHEN qualified_status = 'qualified' THEN 'screening'
            WHEN qualified_status = 'not_qualified' THEN 'ineligible'
            ELSE 'contacted'
          END,
          updated_at = NOW()
        WHERE id = ?
      `, [
        patient_lead_name,
        this.encrypt(phone_2),
        this.encrypt(date_of_birth),
        age,
        height,
        weight_lbs,
        this.encrypt(habits),
        this.encrypt(medications),
        this.encrypt(diagnosis),
        this.encrypt(surgeries),
        banned ? 1 : 0,
        qualified_status,
        this.encrypt(not_interested_reasons),
        patientId
      ]);

      return await this.getPatientLeadById(patientId);
    } catch (error) {
      console.error('Error in updatePatientExtendedForm:', error);
      throw error;
    }
  }

  // Get patient lead by ID with decrypted data
  static async getPatientLeadById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          p.*,
          u.username as lead_owner_name,
          s.name as study_name
        FROM patients p
        LEFT JOIN users u ON p.patient_lead_owner_id = u.id
        LEFT JOIN studies s ON p.study_id = s.id
        WHERE p.id = ? AND p.is_active = 1
      `, [id]);

      if (rows.length === 0) return null;

      const patient = rows[0];
      
      // Decrypt sensitive fields
      return {
        ...patient,
        first_name: this.decrypt(patient.first_name_encrypted),
        last_name: this.decrypt(patient.last_name_encrypted),
        email: this.decrypt(patient.email_encrypted),
        phone: this.decrypt(patient.phone_encrypted),
        phone_2: this.decrypt(patient.phone_2_encrypted),
        date_of_birth: this.decrypt(patient.date_of_birth_encrypted),
        habits: this.decrypt(patient.habits_encrypted),
        medications: this.decrypt(patient.medications_encrypted),
        diagnosis: this.decrypt(patient.diagnosis_encrypted),
        surgeries: this.decrypt(patient.surgeries_encrypted),
        not_interested_reasons: this.decrypt(patient.not_interested_reasons_encrypted)
      };
    } catch (error) {
      console.error('Error in getPatientLeadById:', error);
      throw error;
    }
  }

  // Get all patient leads with filtering and pagination
  static async getAllPatientLeads(filters = {}) {
    try {
      // Simple query without dynamic parameters for now
      const [rows] = await pool.execute(`
        SELECT
          id,
          patient_id,
          first_name_encrypted,
          last_name_encrypted,
          email_encrypted,
          phone_encrypted,
          patient_status,
          qualified_status,
          patient_lead_source,
          patient_lead_owner_id,
          created_at,
          lead_created_at
        FROM patients
        WHERE is_active = 1
        ORDER BY created_at DESC
        LIMIT 50
      `);

      // Decrypt sensitive data for each patient
      const decryptedPatients = rows.map(patient => ({
        ...patient,
        first_name: this.decrypt(patient.first_name_encrypted),
        last_name: this.decrypt(patient.last_name_encrypted),
        email: this.decrypt(patient.email_encrypted),
        phone: this.decrypt(patient.phone_encrypted)
      }));

      return {
        patients: decryptedPatients,
        pagination: {
          page: 1,
          limit: 50,
          total: rows.length,
          totalPages: 1
        }
      };
    } catch (error) {
      console.error('Error in getAllPatientLeads:', error);
      throw error;
    }
  }

  // Enroll patient in study
  static async enrollPatientInStudy(patientId, studyId, enrollmentData = {}) {
    try {
      const {
        screening_number,
        randomization_number,
        study_arm,
        site_id,
        enrolled_by
      } = enrollmentData;

      await pool.execute(`
        UPDATE patients SET
          study_id = ?,
          patient_status = 'enrolled',
          recruitment_status = 'enrolled',
          enrollment_date = NOW(),
          screening_number = ?,
          randomization_number = ?,
          study_arm = ?,
          site_id = ?,
          updated_at = NOW()
        WHERE id = ?
      `, [studyId, screening_number, randomization_number, study_arm, site_id, patientId]);

      // Also create entry in study_participants table
      await pool.execute(`
        INSERT INTO study_participants (
          study_id, patient_id, enrollment_status, enrolled_by, enrollment_date, is_active
        ) VALUES (?, ?, 'enrolled', ?, CURDATE(), 1)
        ON DUPLICATE KEY UPDATE
          enrollment_status = 'enrolled',
          enrolled_by = ?,
          enrollment_date = CURDATE(),
          is_active = 1
      `, [studyId, patientId, enrolled_by, enrolled_by]);

      return await this.getPatientLeadById(patientId);
    } catch (error) {
      console.error('Error in enrollPatientInStudy:', error);
      throw error;
    }
  }

  // Get patient lead statistics
  static async getPatientLeadStats(filters = {}) {
    try {
      const { patient_lead_owner_id, study_id } = filters;
      
      let whereConditions = ['is_active = 1'];
      let queryParams = [];

      if (patient_lead_owner_id) {
        whereConditions.push('patient_lead_owner_id = ?');
        queryParams.push(patient_lead_owner_id);
      }

      if (study_id) {
        whereConditions.push('study_id = ?');
        queryParams.push(study_id);
      }

      const whereClause = whereConditions.join(' AND ');

      const [stats] = await pool.execute(`
        SELECT 
          COUNT(*) as total_leads,
          COUNT(CASE WHEN patient_status = 'lead' THEN 1 END) as new_leads,
          COUNT(CASE WHEN patient_status = 'screening' THEN 1 END) as screening,
          COUNT(CASE WHEN patient_status = 'enrolled' THEN 1 END) as enrolled,
          COUNT(CASE WHEN patient_status = 'not_interested' THEN 1 END) as not_interested,
          COUNT(CASE WHEN qualified_status = 'qualified' THEN 1 END) as qualified,
          COUNT(CASE WHEN qualified_status = 'not_qualified' THEN 1 END) as not_qualified,
          COUNT(CASE WHEN qualified_status = 'pending' THEN 1 END) as pending_qualification,
          COUNT(CASE WHEN extended_form_completed = 1 THEN 1 END) as extended_forms_completed,
          COUNT(CASE WHEN banned = 1 THEN 1 END) as banned_leads
        FROM patients
        WHERE ${whereClause}
      `, queryParams);

      return stats[0];
    } catch (error) {
      console.error('Error in getPatientLeadStats:', error);
      throw error;
    }
  }
}

module.exports = PatientLeadModel;
