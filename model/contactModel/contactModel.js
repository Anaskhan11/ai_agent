const pool = require("../../config/DBConnection");

// Get all contacts/patients with pagination and search
const getAllContacts = async (page, limit, search, userId = null, filters = {}) => {
  let whereClause = "";
  let values = [];

  // Add user filter through lists table if provided
  if (userId) {
    whereClause = "WHERE l.userId = ?";
    values = [userId];
  }

  // Add search functionality - now includes patient-specific fields
  if (search && search.trim() !== "") {
    const searchCondition = userId
      ? " AND (c.email LIKE ? OR c.phoneNumber LIKE ? OR c.fullName LIKE ? OR c.patient_lead_name LIKE ? OR c.patient_lead_source LIKE ?)"
      : "WHERE c.email LIKE ? OR c.phoneNumber LIKE ? OR c.fullName LIKE ? OR c.patient_lead_name LIKE ? OR c.patient_lead_source LIKE ?";
    whereClause += searchCondition;
    values.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Add patient-specific filters
  if (filters.status) {
    const statusCondition = userId ? " AND c.status = ?" : (whereClause ? " AND c.status = ?" : "WHERE c.status = ?");
    whereClause += statusCondition;
    values.push(filters.status);
  }

  if (filters.qualified_status) {
    const qualifiedCondition = userId ? " AND c.qualified_status = ?" : (whereClause ? " AND c.qualified_status = ?" : "WHERE c.qualified_status = ?");
    whereClause += qualifiedCondition;
    values.push(filters.qualified_status);
  }

  if (filters.banned !== undefined) {
    const bannedCondition = userId ? " AND c.banned = ?" : (whereClause ? " AND c.banned = ?" : "WHERE c.banned = ?");
    whereClause += bannedCondition;
    values.push(filters.banned);
  }

  if (filters.dnq !== undefined) {
    const dnqCondition = userId ? " AND c.dnq = ?" : (whereClause ? " AND c.dnq = ?" : "WHERE c.dnq = ?");
    whereClause += dnqCondition;
    values.push(filters.dnq);
  }

  if (filters.patient_lead_owner) {
    const ownerCondition = userId ? " AND c.patient_lead_owner = ?" : (whereClause ? " AND c.patient_lead_owner = ?" : "WHERE c.patient_lead_owner = ?");
    whereClause += ownerCondition;
    values.push(filters.patient_lead_owner);
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM contacts c
    LEFT JOIN lists l ON c.listId = l.id
    ${whereClause}
  `;
  const [totalRows] = await pool.query(countQuery, values);
  const totalContacts = totalRows[0]?.total || 0;

  const totalPages = Math.ceil(totalContacts / limit);
  const adjustedPage = page > totalPages && totalPages > 0 ? totalPages : page;
  const offset = (adjustedPage - 1) * limit;

  // Get paginated contacts with list information and patient details
  const sql = `
    SELECT
      c.id,
      c.fullName,
      c.email,
      c.phoneNumber,
      c.phone2,
      c.listId,
      c.createdAt,
      c.updated_at,
      c.patient_lead_source,
      c.banned,
      c.patient_lead_owner,
      c.patient_lead_name,
      c.date_of_birth,
      c.age,
      c.height,
      c.weight_lbs,
      c.habits,
      c.medications,
      c.diagnosis,
      c.surgeries,
      c.status,
      c.qualified_status,
      c.dnq,
      c.not_interested_reasons,
      c.created_by,
      c.modified_by,
      l.list_name as list_title,
      l.type as list_type,
      creator.name as created_by_name,
      modifier.name as modified_by_name
    FROM contacts c
    LEFT JOIN lists l ON c.listId = l.id
    LEFT JOIN users creator ON c.created_by = creator.id
    LEFT JOIN users modifier ON c.modified_by = modifier.id
    ${whereClause}
    ORDER BY c.createdAt DESC
    LIMIT ? OFFSET ?
  `;
  values.push(parseInt(limit), parseInt(offset));

  const [rows] = await pool.query(sql, values);
  return { contacts: rows, totalContacts, currentPage: adjustedPage, totalPages };
};

const getListNamesWithContactCount = async (userId = null) => {
  let whereClause = "";
  let values = [];

  if (userId) {
    whereClause = "WHERE l.userId = ?";
    values = [userId];
  }

  const sql = `
    SELECT
      l.listName,
      l.id,
      l.description,
      l.createdAt,
      COUNT(c.id) as contact_count
    FROM lists l
    LEFT JOIN contacts c ON l.id = c.listId
    ${whereClause}
    GROUP BY l.id, l.listName, l.description, l.createdAt
    ORDER BY contact_count DESC
  `;
  const [rows] = await pool.query(sql, values);
  return rows;
};

const getContactById = async (contactId) => {
  const sql = `
    SELECT
      c.*,
      l.list_name,
      l.type as list_type,
      creator.name as created_by_name,
      creator.email as created_by_email,
      modifier.name as modified_by_name,
      modifier.email as modified_by_email
    FROM contacts c
    LEFT JOIN lists l ON c.listId = l.id
    LEFT JOIN users creator ON c.created_by = creator.id
    LEFT JOIN users modifier ON c.modified_by = modifier.id
    WHERE c.id = ?
  `;

  const [rows] = await pool.query(sql, [contactId]);
  return rows[0];
};

// Create contacts for a specific list
const createContactsForList = async (listId, userId, contacts) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify list exists and user owns it
    const [listInfo] = await connection.query(
      'SELECT id FROM lists WHERE id = ? AND userId = ?',
      [listId, userId]
    );

    if (listInfo.length === 0) {
      throw new Error('List not found or access denied');
    }

    // Insert contacts with enhanced patient structure
    const sql = `
      INSERT INTO contacts (
        fullName, email, phoneNumber, phone2, listId,
        patient_lead_source, banned, patient_lead_owner, patient_lead_name,
        date_of_birth, age, height, weight_lbs, habits, medications,
        diagnosis, surgeries, status, qualified_status, dnq,
        not_interested_reasons, created_by, modified_by
      ) VALUES ?
    `;

    const values = contacts.map((contact) => [
      contact.fullName || contact.first_name || '',
      contact.email,
      contact.phoneNumber || contact.contact_number,
      contact.phone2 || null,
      listId,
      contact.patient_lead_source || null,
      contact.banned || false,
      contact.patient_lead_owner || null,
      contact.patient_lead_name || null,
      contact.date_of_birth || null,
      contact.age || null,
      contact.height || null,
      contact.weight_lbs || null,
      contact.habits || null,
      contact.medications || null,
      contact.diagnosis || null,
      contact.surgeries || null,
      contact.status || 'new',
      contact.qualified_status || 'pending',
      contact.dnq || false,
      contact.not_interested_reasons || null,
      contact.created_by || userId,
      contact.modified_by || userId
    ]);

    const [result] = await connection.query(sql, [values]);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Legacy function for backward compatibility
const createContacts = async (
  user_id,
  list_name,
  list_description,
  contacts
) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // First create or get the list
    let listId;
    const [existingList] = await connection.query(
      'SELECT id FROM lists WHERE listName = ? AND userId = ?',
      [list_name, user_id]
    );

    if (existingList.length > 0) {
      listId = existingList[0].id;
    } else {
      // Create new list with new structure
      const [listResult] = await connection.query(
        'INSERT INTO lists (userId, listName, description, type) VALUES (?, ?, ?, ?)',
        [user_id, list_name, list_description, 'General']
      );
      listId = listResult.insertId;
    }

    // Insert contacts with new simplified structure
    const sql = `
      INSERT INTO contacts (fullName, email, phoneNumber, listId)
      VALUES ?
    `;

    const values = contacts.map((contact) => [
      contact.first_name || contact.fullName || '',
      contact.email,
      contact.contact_number || contact.phoneNumber,
      listId
    ]);

    const [result] = await connection.query(sql, [values]);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Legacy update function - simplified for new structure
const updateContact = async (
  user_id,
  list_name,
  list_description,
  contacts
) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const contact of contacts) {
      // Update contact with new structure, verify ownership through lists table
      await connection.query(`
        UPDATE contacts c
        JOIN lists l ON c.listId = l.id
        SET c.fullName = ?, c.email = ?, c.phoneNumber = ?
        WHERE c.id = ? AND l.userId = ?
      `, [
        contact.fullName || contact.first_name || '',
        contact.email,
        contact.phoneNumber || contact.contact_number,
        contact.contact_id || contact.id,
        user_id,
      ]);
    }

    await connection.commit();
    return { message: "Contacts updated successfully" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const deleteContact = async (contactId, userId = null) => {
  if (userId) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // First verify user ownership without deleting
      const [ownershipCheck] = await connection.query(`
        SELECT c.id, c.listId
        FROM contacts c
        JOIN lists l ON c.listId = l.id
        WHERE c.id = ? AND l.userId = ?
      `, [contactId, userId]);

      if (ownershipCheck.length === 0) {
        throw new Error('Contact not found or access denied');
      }

      // Delete contact directly without JOIN to avoid trigger conflicts
      const [result] = await connection.query(
        "DELETE FROM contacts WHERE id = ?",
        [contactId]
      );

      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } else {
    // Direct delete (for backward compatibility)
    const [result] = await pool.query(
      "DELETE FROM contacts WHERE id = ?",
      [contactId]
    );
    return result;
  }
};

// Get contacts by list ID with pagination
const getContactsByListId = async (listId, userId, page = 1, limit = 10, search = "") => {
  let whereClause = "WHERE c.listId = ? AND l.userId = ?";
  let values = [listId, userId];

  // Add search functionality
  if (search && search.trim() !== "") {
    whereClause += " AND (c.email LIKE ? OR c.phoneNumber LIKE ? OR c.fullName LIKE ?)";
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Get total count
  const countQuery = `
    SELECT COUNT(*) as total
    FROM contacts c
    JOIN lists l ON c.listId = l.id
    ${whereClause}
  `;
  const [totalRows] = await pool.query(countQuery, values);
  const totalContacts = totalRows[0]?.total || 0;

  const totalPages = Math.ceil(totalContacts / limit);
  const currentPage = page > totalPages && totalPages > 0 ? totalPages : page;
  const offset = (currentPage - 1) * limit;

  // Get contacts with list information
  const sql = `
    SELECT c.*, l.listName, l.description, l.type as list_type
    FROM contacts c
    JOIN lists l ON c.listId = l.id
    ${whereClause}
    ORDER BY c.createdAt DESC
    LIMIT ? OFFSET ?
  `;
  values.push(parseInt(limit), parseInt(offset));

  const [rows] = await pool.query(sql, values);

  return {
    contacts: rows,
    total_contacts: totalContacts,
    current_page: currentPage,
    total_pages: totalPages,
    list_info: rows.length > 0 ? {
      id: listId,
      listName: rows[0].listName,
      description: rows[0].description,
      type: rows[0].list_type
    } : null
  };
};

// Legacy function for backward compatibility
const getContactsByList = async (list_name, page, limit) => {
  const offset = (page - 1) * limit;

  // Query to get total number of contacts for the given list_name
  const [totalRows] = await pool.query(
    "SELECT COUNT(*) as total FROM contacts c JOIN lists l ON c.listId = l.id WHERE l.list_name = ?",
    [list_name]
  );
  const totalContacts = totalRows[0]?.total || 0;

  // Calculate total pages
  const totalPages = Math.ceil(totalContacts / limit);
  const currentPage = page > totalPages && totalPages > 0 ? totalPages : page;

  // Adjust offset if page number exceeds total pages
  const adjustedOffset = (currentPage - 1) * limit;

  // Query to get contacts with pagination
  const sql = `
    SELECT c.id as contact_id, l.list_name, l.description as list_description, c.email, c.phoneNumber as contact_number, c.fullName as first_name, c.phoneNumber as phone_number, c.createdAt as created_at
    FROM contacts c
    JOIN lists l ON c.listId = l.id
    WHERE l.list_name = ?
    ORDER BY c.createdAt DESC
    LIMIT ? OFFSET ?
  `;
  const [rows] = await pool.query(sql, [
    list_name,
    parseInt(limit),
    parseInt(adjustedOffset),
  ]);

  // If no contacts are found
  if (rows.length === 0) {
    return null;
  }

  // Since list_name and list_description are the same for all rows
  const listDescription = rows[0].list_description;

  return {
    list_name,
    list_description: listDescription,
    contacts: rows,
    total_contacts: totalContacts,
    current_page: currentPage,
    total_pages: totalPages,
  };
};



// Add a single contact to a list
const addContactToList = async (listId, userId, contactData) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Verify list exists and user owns it
    const [listInfo] = await connection.query(
      'SELECT id FROM lists WHERE id = ? AND userId = ?',
      [listId, userId]
    );

    if (listInfo.length === 0) {
      throw new Error('List not found or access denied');
    }

    // Insert contact with new simplified structure
    const sql = `
      INSERT INTO contacts (fullName, email, phoneNumber, listId)
      VALUES (?, ?, ?, ?)
    `;

    const [result] = await connection.query(sql, [
      contactData.fullName || contactData.first_name || '',
      contactData.email,
      contactData.phoneNumber || contactData.contact_number,
      listId
    ]);

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Update a contact by ID
const updateContactById = async (contactId, userId, updates) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // First verify user ownership without updating
    const [ownershipCheck] = await connection.query(`
      SELECT c.id, c.listId
      FROM contacts c
      JOIN lists l ON c.listId = l.id
      WHERE c.id = ? AND l.userId = ?
    `, [contactId, userId]);

    if (ownershipCheck.length === 0) {
      throw new Error('Contact not found or access denied');
    }

    const allowedFields = [
      'fullName', 'email', 'phoneNumber', 'phone2',
      'patient_lead_source', 'banned', 'patient_lead_owner', 'patient_lead_name',
      'date_of_birth', 'age', 'height', 'weight_lbs', 'habits', 'medications',
      'diagnosis', 'surgeries', 'status', 'qualified_status', 'dnq',
      'not_interested_reasons', 'modified_by'
    ];
    const setClause = [];
    const values = [];

    // Build dynamic SET clause
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        setClause.push(`${key} = ?`);
        values.push(value);
      }
    }

    // Handle legacy field names
    if (updates.first_name !== undefined) {
      setClause.push('fullName = ?');
      values.push(updates.first_name);
    }
    if (updates.contact_number !== undefined) {
      setClause.push('phoneNumber = ?');
      values.push(updates.contact_number);
    }

    // Always update modified_by and updated_at
    if (!updates.modified_by) {
      setClause.push('modified_by = ?');
      values.push(userId);
    }
    setClause.push('updated_at = CURRENT_TIMESTAMP');

    if (setClause.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Update contact directly without JOIN to avoid trigger conflicts
    values.push(contactId);
    const sql = `
      UPDATE contacts
      SET ${setClause.join(', ')}
      WHERE id = ?
    `;

    const [result] = await connection.query(sql, values);

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Remove a contact from a specific list
const removeContactFromList = async (listId, contactId, userId) => {
  // First verify user ownership of the list (separate query to avoid trigger conflicts)
  const checkOwnershipSql = `
    SELECT id FROM lists
    WHERE id = ? AND userId = ?
  `;

  const [ownershipResult] = await pool.query(checkOwnershipSql, [listId, userId]);

  if (ownershipResult.length === 0) {
    // User doesn't own this list, return no affected rows
    return { affectedRows: 0 };
  }

  // Now delete the contact using a simple DELETE (no JOIN to avoid trigger conflicts)
  const deleteSql = `
    DELETE FROM contacts
    WHERE id = ? AND listId = ?
  `;

  const [result] = await pool.query(deleteSql, [contactId, listId]);
  return result;
};

// Get patient statistics
const getPatientStats = async (userId = null) => {
  let whereClause = "";
  let values = [];

  if (userId) {
    whereClause = "WHERE l.userId = ?";
    values = [userId];
  }

  const sql = `
    SELECT
      COUNT(*) as total_patients,
      COUNT(CASE WHEN c.status = 'new' THEN 1 END) as new_patients,
      COUNT(CASE WHEN c.status = 'contacted' THEN 1 END) as contacted_patients,
      COUNT(CASE WHEN c.status = 'screening' THEN 1 END) as screening_patients,
      COUNT(CASE WHEN c.status = 'qualified' THEN 1 END) as qualified_patients,
      COUNT(CASE WHEN c.status = 'enrolled' THEN 1 END) as enrolled_patients,
      COUNT(CASE WHEN c.qualified_status = 'qualified' THEN 1 END) as study_qualified,
      COUNT(CASE WHEN c.qualified_status = 'not_qualified' THEN 1 END) as study_not_qualified,
      COUNT(CASE WHEN c.banned = true THEN 1 END) as banned_patients,
      COUNT(CASE WHEN c.dnq = true THEN 1 END) as dnq_patients
    FROM contacts c
    LEFT JOIN lists l ON c.listId = l.id
    ${whereClause}
  `;

  const [rows] = await pool.query(sql, values);
  return rows[0];
};

// Update patient age based on date of birth
const updatePatientAge = async (patientId) => {
  const sql = `
    UPDATE contacts
    SET age = TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())
    WHERE id = ? AND date_of_birth IS NOT NULL
  `;

  const [result] = await pool.query(sql, [patientId]);
  return result;
};

// Search patients with advanced filters
const searchPatients = async (searchParams, userId = null) => {
  const {
    query, status, qualified_status, banned, dnq,
    age_min, age_max, patient_lead_owner, patient_lead_source,
    page = 1, limit = 10
  } = searchParams;

  let whereClause = "";
  let values = [];

  if (userId) {
    whereClause = "WHERE l.userId = ?";
    values = [userId];
  }

  // Add search conditions
  if (query && query.trim() !== "") {
    const searchCondition = userId
      ? " AND (c.fullName LIKE ? OR c.email LIKE ? OR c.phoneNumber LIKE ? OR c.patient_lead_name LIKE ?)"
      : "WHERE c.fullName LIKE ? OR c.email LIKE ? OR c.phoneNumber LIKE ? OR c.patient_lead_name LIKE ?";
    whereClause += searchCondition;
    const searchTerm = `%${query}%`;
    values.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  // Add filter conditions
  if (status) {
    whereClause += userId || query ? " AND c.status = ?" : "WHERE c.status = ?";
    values.push(status);
  }

  if (qualified_status) {
    whereClause += (userId || query || status) ? " AND c.qualified_status = ?" : "WHERE c.qualified_status = ?";
    values.push(qualified_status);
  }

  if (banned !== undefined) {
    whereClause += (whereClause.includes("WHERE")) ? " AND c.banned = ?" : "WHERE c.banned = ?";
    values.push(banned);
  }

  if (dnq !== undefined) {
    whereClause += (whereClause.includes("WHERE")) ? " AND c.dnq = ?" : "WHERE c.dnq = ?";
    values.push(dnq);
  }

  if (age_min) {
    whereClause += (whereClause.includes("WHERE")) ? " AND c.age >= ?" : "WHERE c.age >= ?";
    values.push(age_min);
  }

  if (age_max) {
    whereClause += (whereClause.includes("WHERE")) ? " AND c.age <= ?" : "WHERE c.age <= ?";
    values.push(age_max);
  }

  if (patient_lead_owner) {
    whereClause += (whereClause.includes("WHERE")) ? " AND c.patient_lead_owner = ?" : "WHERE c.patient_lead_owner = ?";
    values.push(patient_lead_owner);
  }

  if (patient_lead_source) {
    whereClause += (whereClause.includes("WHERE")) ? " AND c.patient_lead_source = ?" : "WHERE c.patient_lead_source = ?";
    values.push(patient_lead_source);
  }

  // Get total count
  const countSql = `
    SELECT COUNT(*) as total
    FROM contacts c
    LEFT JOIN lists l ON c.listId = l.id
    ${whereClause}
  `;
  const [countResult] = await pool.query(countSql, values);
  const totalPatients = countResult[0].total;

  // Get paginated results
  const offset = (page - 1) * limit;
  const sql = `
    SELECT
      c.*,
      l.list_name,
      l.type as list_type,
      creator.name as created_by_name,
      modifier.name as modified_by_name
    FROM contacts c
    LEFT JOIN lists l ON c.listId = l.id
    LEFT JOIN users creator ON c.created_by = creator.id
    LEFT JOIN users modifier ON c.modified_by = modifier.id
    ${whereClause}
    ORDER BY c.createdAt DESC
    LIMIT ? OFFSET ?
  `;

  values.push(parseInt(limit), parseInt(offset));
  const [patients] = await pool.query(sql, values);

  return {
    patients,
    totalPatients,
    currentPage: page,
    totalPages: Math.ceil(totalPatients / limit)
  };
};

module.exports = {
  getAllContacts,
  getListNamesWithContactCount,
  getContactById,
  createContacts,
  createContactsForList,
  updateContact,
  updateContactById,
  deleteContact,
  getContactsByList,
  getContactsByListId,
  addContactToList,
  removeContactFromList,
  getPatientStats,
  updatePatientAge,
  searchPatients,
};
