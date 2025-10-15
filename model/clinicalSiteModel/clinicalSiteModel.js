const pool = require('../../config/DBConnection');

class ClinicalSiteModel {
  static async getAllSites() {
    try {
      const [rows] = await pool.execute(`
        SELECT
          s.*,
          COUNT(DISTINCT st.id) as active_studies,
          COUNT(DISTINCT sp.id) as total_participants
        FROM sites s
        LEFT JOIN studies st ON s.id = st.site_id AND st.is_active = 1
        LEFT JOIN study_participants sp ON st.id = sp.study_id AND sp.is_active = 1
        WHERE s.is_active = 1
        GROUP BY s.id
        ORDER BY s.created_at DESC
      `);
      return rows;
    } catch (error) {
      console.error('Error in getAllSites:', error);
      throw error;
    }
  }

  static async getSiteById(id) {
    try {
      const [rows] = await pool.execute(`
        SELECT
          s.*,
          COUNT(DISTINCT st.id) as active_studies,
          COUNT(DISTINCT sp.id) as total_participants
        FROM sites s
        LEFT JOIN studies st ON s.id = st.site_id AND st.is_active = 1
        LEFT JOIN study_participants sp ON st.id = sp.study_id AND sp.is_active = 1
        WHERE s.id = ? AND s.is_active = 1
        GROUP BY s.id
      `, [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error in getSiteById:', error);
      throw error;
    }
  }

  static async createSite(siteData) {
    try {
      const {
        site_name,
        site_code,
        description,
        address,
        city,
        state,
        country,
        postal_code,
        phone,
        email,
        contact_person
      } = siteData;

      const [result] = await pool.execute(`
        INSERT INTO sites (
          site_name, site_code, description, address, city, state, country,
          postal_code, phone, email, contact_person, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
      `, [
        site_name, site_code, description, address, city, state, country,
        postal_code, phone, email, contact_person
      ]);

      return await this.getSiteById(result.insertId);
    } catch (error) {
      console.error('Error in createSite:', error);
      throw error;
    }
  }

  static async updateSite(id, siteData) {
    try {
      const {
        site_name,
        site_code,
        description,
        address,
        city,
        state,
        country,
        postal_code,
        phone,
        email,
        contact_person
      } = siteData;

      await pool.execute(`
        UPDATE sites SET
          site_name = ?, site_code = ?, description = ?, address = ?, city = ?,
          state = ?, country = ?, postal_code = ?, phone = ?, email = ?,
          contact_person = ?, updated_at = NOW()
        WHERE id = ? AND is_active = 1
      `, [
        site_name, site_code, description, address, city, state, country,
        postal_code, phone, email, contact_person, id
      ]);

      return await this.getSiteById(id);
    } catch (error) {
      console.error('Error in updateSite:', error);
      throw error;
    }
  }

  static async deleteSite(id) {
    try {
      await pool.execute(`
        UPDATE sites SET is_active = 0, updated_at = NOW() WHERE id = ?
      `, [id]);
      return true;
    } catch (error) {
      console.error('Error in deleteSite:', error);
      throw error;
    }
  }

  static async getSiteStats() {
    try {
      const [stats] = await pool.execute(`
        SELECT
          COUNT(*) as total_sites,
          COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_sites,
          COUNT(CASE WHEN is_active = 0 THEN 1 END) as inactive_sites
        FROM sites
      `);
      return stats[0];
    } catch (error) {
      console.error('Error in getSiteStats:', error);
      throw error;
    }
  }

  static async getSiteStudies(siteId) {
    try {
      const [rows] = await pool.execute(`
        SELECT
          st.*,
          COUNT(DISTINCT sp.id) as participant_count,
          u.username as pi_name
        FROM studies st
        LEFT JOIN users u ON st.principal_investigator_id = u.id
        LEFT JOIN study_participants sp ON st.id = sp.study_id AND sp.is_active = 1
        WHERE st.site_id = ? AND st.is_active = 1
        GROUP BY st.id
        ORDER BY st.created_at DESC
      `, [siteId]);
      return rows;
    } catch (error) {
      console.error('Error in getSiteStudies:', error);
      throw error;
    }
  }
}

module.exports = ClinicalSiteModel;
