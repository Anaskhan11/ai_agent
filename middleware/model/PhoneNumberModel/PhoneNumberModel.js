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

// Create phone number record in local database
const createPhoneNumber = async (phoneNumberData) => {
  return await retryDbOperation(async () => {
    const {
      user_id,
      phone_number_id,
      org_id,
      number,
      country_code,
      provider,
      type = 'local',
      capabilities,
      sip_uri,
      fallback_destination,
      assistant_id,
      squad_id,
      workflow_id,
      status = 'active',
      metadata = {}
    } = phoneNumberData;

    const insertSQL = `
      INSERT INTO phone_numbers (
        user_id, phone_number_id, org_id, number, country_code, provider,
        type, capabilities, sip_uri, fallback_destination, assistant_id,
        squad_id, workflow_id, status, metadata, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const params = [
      user_id || null,
      phone_number_id || null,
      org_id || null,
      number || null,
      country_code || null,
      provider || null,
      type || 'local',
      JSON.stringify(capabilities || {}),
      sip_uri || null,
      fallback_destination || null,
      assistant_id || null,
      squad_id || null,
      workflow_id || null,
      status || 'active',
      JSON.stringify(metadata || {})
    ];

    // Debug logging to see what's being passed to the database
    console.log('📊 PhoneNumberModel - Database insertion params:');
    params.forEach((param, index) => {
      console.log(`  [${index}]: ${param} (type: ${typeof param})`);
    });

    const [result] = await pool.execute(insertSQL, params);
    return result.insertId;
  });
};

// Get phone numbers by user ID
const getPhoneNumbersByUserId = async (userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        pn.*,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email as user_email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM phone_numbers pn
      LEFT JOIN users u ON pn.user_id = u.id
      WHERE pn.user_id = ? AND pn.status = 'active'
      ORDER BY pn.created_at DESC
    `;
    const [rows] = await pool.execute(sql, [userId]);
    return rows;
  });
};

// Get phone number by ID and user ID
const getPhoneNumberByIdAndUserId = async (phoneNumberId, userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT * FROM phone_numbers 
      WHERE phone_number_id = ? AND user_id = ?
    `;
    const [rows] = await pool.execute(sql, [phoneNumberId, userId]);
    return rows[0];
  });
};

// Update phone number record
const updatePhoneNumber = async (phoneNumberId, userId, updateData) => {
  return await retryDbOperation(async () => {
    const {
      number,
      country_code,
      provider,
      type,
      capabilities,
      sip_uri,
      fallback_destination,
      assistant_id,
      squad_id,
      workflow_id,
      status,
      metadata
    } = updateData;

    const updateSQL = `
      UPDATE phone_numbers SET
        number = COALESCE(?, number),
        country_code = COALESCE(?, country_code),
        provider = COALESCE(?, provider),
        type = COALESCE(?, type),
        capabilities = COALESCE(?, capabilities),
        sip_uri = COALESCE(?, sip_uri),
        fallback_destination = COALESCE(?, fallback_destination),
        assistant_id = COALESCE(?, assistant_id),
        squad_id = COALESCE(?, squad_id),
        workflow_id = COALESCE(?, workflow_id),
        status = COALESCE(?, status),
        metadata = COALESCE(?, metadata),
        updated_at = NOW()
      WHERE phone_number_id = ? AND user_id = ?
    `;

    const params = [
      number,
      country_code,
      provider,
      type,
      capabilities ? JSON.stringify(capabilities) : null,
      sip_uri,
      fallback_destination,
      assistant_id,
      squad_id,
      workflow_id,
      status,
      metadata ? JSON.stringify(metadata) : null,
      phoneNumberId,
      userId
    ];

    const [result] = await pool.execute(updateSQL, params);
    return result.affectedRows;
  });
};

// Delete phone number record
const deletePhoneNumber = async (phoneNumberId, userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      DELETE FROM phone_numbers 
      WHERE phone_number_id = ? AND user_id = ?
    `;
    const [result] = await pool.execute(sql, [phoneNumberId, userId]);
    return result.affectedRows;
  });
};

// Get all phone numbers (super admin only)
const getAllPhoneNumbers = async () => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT * FROM phone_numbers
      ORDER BY created_at DESC
    `;
    const [rows] = await pool.execute(sql);
    return rows;
  });
};

// Get all phone numbers with user information (super admin only)
const getAllPhoneNumbersWithUsers = async () => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT
        pn.*,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email as user_email,
        CONCAT(u.first_name, ' ', u.last_name) as user_name
      FROM phone_numbers pn
      LEFT JOIN users u ON pn.user_id = u.id
      ORDER BY pn.created_at DESC
    `;
    const [rows] = await pool.execute(sql);
    return rows;
  });
};

// Check if phone number exists for user
const phoneNumberExistsForUser = async (phoneNumberId, userId) => {
  return await retryDbOperation(async () => {
    const sql = `
      SELECT COUNT(*) as count FROM phone_numbers 
      WHERE phone_number_id = ? AND user_id = ?
    `;
    const [rows] = await pool.execute(sql, [phoneNumberId, userId]);
    return rows[0].count > 0;
  });
};

module.exports = {
  createPhoneNumber,
  getPhoneNumbersByUserId,
  getPhoneNumberByIdAndUserId,
  updatePhoneNumber,
  deletePhoneNumber,
  getAllPhoneNumbers,
  getAllPhoneNumbersWithUsers,
  phoneNumberExistsForUser
};
