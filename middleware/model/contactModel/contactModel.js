const pool = require("../../config/DBConnection");

// Get all contacts with pagination and search
const getAllContacts = async (page, limit, search, userId = null) => {
  let whereClause = "";
  let values = [];

  // Add user filter through lists table if provided
  if (userId) {
    whereClause = "WHERE l.userId = ?";
    values = [userId];
  }

  // Add search functionality
  if (search && search.trim() !== "") {
    const searchCondition = userId
      ? " AND (c.email LIKE ? OR c.phoneNumber LIKE ? OR c.fullName LIKE ?)"
      : "WHERE c.email LIKE ? OR c.phoneNumber LIKE ? OR c.fullName LIKE ?";
    whereClause += searchCondition;
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
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

  // Get paginated contacts with list information
  const sql = `
    SELECT c.*, l.listName as list_title, l.type as list_type
    FROM contacts c
    LEFT JOIN lists l ON c.listId = l.id
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
  const [rows] = await pool.query(
    "SELECT * FROM contacts WHERE id = ?",
    [contactId]
  );
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

    // Insert contacts with new simplified structure
    const sql = `
      INSERT INTO contacts (fullName, email, phoneNumber, listId)
      VALUES ?
    `;

    const values = contacts.map((contact) => [
      contact.fullName || contact.first_name || '',
      contact.email,
      contact.phoneNumber || contact.contact_number,
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
    "SELECT COUNT(*) as total FROM contacts WHERE list_name = ?",
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
    SELECT contact_id, list_name, list_description, email, contact_number, first_name, phone_number, created_at
    FROM contacts
    WHERE list_name = ?
    ORDER BY created_at DESC
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

    const allowedFields = ['fullName', 'email', 'phoneNumber'];
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
};
