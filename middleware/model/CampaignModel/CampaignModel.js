const pool = require("../../config/DBConnection");

// Database retry operation helper
const retryDbOperation = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Database operation attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

// Create campaign record in local database
const createCampaign = async (campaignData) => {
  return await retryDbOperation(async () => {
    const {
      user_id,
      campaign_id,
      org_id,
      name,
      description,
      type = 'outbound_calls',
      assistant_id,
      squad_id,
      workflow_id,
      phone_number_id,
      contact_list_ids,
      schedule_config,
      targeting_rules,
      call_settings,
      status = 'draft',
      start_date,
      end_date,
      total_contacts = 0,
      completed_contacts = 0,
      successful_contacts = 0,
      failed_contacts = 0,
      total_cost = 0,
      performance_metrics = {},
      metadata = {}
    } = campaignData;

    const insertSQL = `
      INSERT INTO campaigns (
        user_id, campaign_id, org_id, name, description, type, assistant_id,
        squad_id, workflow_id, phone_number_id, contact_list_ids, schedule_config,
        targeting_rules, call_settings, status, start_date, end_date,
        total_contacts, completed_contacts, successful_contacts, failed_contacts,
        total_cost, performance_metrics, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      user_id || null,
      campaign_id || null,
      org_id || null,
      name || null,
      description || null,
      type || 'outbound_calls',
      assistant_id || null,
      squad_id || null,
      workflow_id || null,
      phone_number_id || null,
      JSON.stringify(contact_list_ids || []),
      JSON.stringify(schedule_config || {}),
      JSON.stringify(targeting_rules || {}),
      JSON.stringify(call_settings || {}),
      status || 'draft',
      start_date || null,
      end_date || null,
      total_contacts || 0,
      completed_contacts || 0,
      successful_contacts || 0,
      failed_contacts || 0,
      total_cost || 0,
      JSON.stringify(performance_metrics || {}),
      JSON.stringify(metadata || {})
    ];

    const [result] = await pool.execute(insertSQL, params);
    return result.insertId;
  });
};

// Get campaigns by user ID
const getCampaignsByUserId = async (userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT * FROM campaigns 
      WHERE user_id = ?
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.execute(sql, [userId]);
    return rows.map(row => ({
      ...row,
      contact_list_ids: JSON.parse(row.contact_list_ids || '[]'),
      schedule_config: JSON.parse(row.schedule_config || '{}'),
      targeting_rules: JSON.parse(row.targeting_rules || '{}'),
      call_settings: JSON.parse(row.call_settings || '{}'),
      performance_metrics: JSON.parse(row.performance_metrics || '{}'),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  });
};

// Get campaign by ID and user ID
const getCampaignByIdAndUserId = async (campaignId, userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT * FROM campaigns 
      WHERE campaign_id = ? AND user_id = ?
    `;
    const [rows] = await pool.execute(sql, [campaignId, userId]);
    if (rows.length === 0) return null;
    
    const row = rows[0];
    return {
      ...row,
      contact_list_ids: JSON.parse(row.contact_list_ids || '[]'),
      schedule_config: JSON.parse(row.schedule_config || '{}'),
      targeting_rules: JSON.parse(row.targeting_rules || '{}'),
      call_settings: JSON.parse(row.call_settings || '{}'),
      performance_metrics: JSON.parse(row.performance_metrics || '{}'),
      metadata: JSON.parse(row.metadata || '{}')
    };
  });
};

// Update campaign record
const updateCampaign = async (campaignId, userId, updateData) => {
  return await retryDbOperation(async () => {
    const {
      name,
      description,
      type,
      assistant_id,
      squad_id,
      workflow_id,
      phone_number_id,
      contact_list_ids,
      schedule_config,
      targeting_rules,
      call_settings,
      status,
      start_date,
      end_date,
      total_contacts,
      completed_contacts,
      successful_contacts,
      failed_contacts,
      total_cost,
      performance_metrics,
      metadata
    } = updateData;

    const updateSQL = `
      UPDATE campaigns SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        type = COALESCE(?, type),
        assistant_id = COALESCE(?, assistant_id),
        squad_id = COALESCE(?, squad_id),
        workflow_id = COALESCE(?, workflow_id),
        phone_number_id = COALESCE(?, phone_number_id),
        contact_list_ids = COALESCE(?, contact_list_ids),
        schedule_config = COALESCE(?, schedule_config),
        targeting_rules = COALESCE(?, targeting_rules),
        call_settings = COALESCE(?, call_settings),
        status = COALESCE(?, status),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        total_contacts = COALESCE(?, total_contacts),
        completed_contacts = COALESCE(?, completed_contacts),
        successful_contacts = COALESCE(?, successful_contacts),
        failed_contacts = COALESCE(?, failed_contacts),
        total_cost = COALESCE(?, total_cost),
        performance_metrics = COALESCE(?, performance_metrics),
        metadata = COALESCE(?, metadata),
        updated_at = NOW()
      WHERE campaign_id = ? AND user_id = ?
    `;

    const params = [
      name,
      description,
      type,
      assistant_id,
      squad_id,
      workflow_id,
      phone_number_id,
      contact_list_ids ? JSON.stringify(contact_list_ids) : null,
      schedule_config ? JSON.stringify(schedule_config) : null,
      targeting_rules ? JSON.stringify(targeting_rules) : null,
      call_settings ? JSON.stringify(call_settings) : null,
      status,
      start_date,
      end_date,
      total_contacts,
      completed_contacts,
      successful_contacts,
      failed_contacts,
      total_cost,
      performance_metrics ? JSON.stringify(performance_metrics) : null,
      metadata ? JSON.stringify(metadata) : null,
      campaignId,
      userId
    ];

    const [result] = await pool.execute(updateSQL, params);
    return result.affectedRows;
  });
};

// Delete campaign record
const deleteCampaign = async (campaignId, userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      DELETE FROM campaigns 
      WHERE campaign_id = ? AND user_id = ?
    `;
    const [result] = await pool.execute(sql, [campaignId, userId]);
    return result.affectedRows;
  });
};

// Get all campaigns (super admin only)
const getAllCampaigns = async () => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT * FROM campaigns 
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.execute(sql);
    return rows.map(row => ({
      ...row,
      contact_list_ids: JSON.parse(row.contact_list_ids || '[]'),
      schedule_config: JSON.parse(row.schedule_config || '{}'),
      targeting_rules: JSON.parse(row.targeting_rules || '{}'),
      call_settings: JSON.parse(row.call_settings || '{}'),
      performance_metrics: JSON.parse(row.performance_metrics || '{}'),
      metadata: JSON.parse(row.metadata || '{}')
    }));
  });
};

// Check if campaign exists for user
const campaignExistsForUser = async (campaignId, userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT COUNT(*) as count FROM campaigns 
      WHERE campaign_id = ? AND user_id = ?
    `;
    const [rows] = await pool.execute(sql, [campaignId, userId]);
    return rows[0].count > 0;
  });
};

module.exports = {
  createCampaign,
  getCampaignsByUserId,
  getCampaignByIdAndUserId,
  updateCampaign,
  deleteCampaign,
  getAllCampaigns,
  campaignExistsForUser
};
