const pool = require("../../config/DBConnection");

// Get all lists for a user with pagination and search
const getAllLists = async (userId, page = 1, limit = 10, search = "") => {
  let whereClause = "WHERE userId = ?";
  let values = [userId];

  // Add search functionality
  if (search && search.trim() !== "") {
    whereClause += " AND (listName LIKE ? OR description LIKE ? OR type LIKE ?)";
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  // Get total count
  const countQuery = `SELECT COUNT(*) as total FROM lists ${whereClause}`;
  const [totalRows] = await pool.query(countQuery, values);
  const totalLists = totalRows[0]?.total || 0;

  const totalPages = Math.ceil(totalLists / limit);
  const adjustedPage = page > totalPages && totalPages > 0 ? totalPages : page;
  const offset = (adjustedPage - 1) * limit;

  // Get paginated lists
  const sql = `
    SELECT id, listName as list_name, type, contacts_count as contactCount, createdAt, userId, description as list_description
    FROM lists
    ${whereClause}
    ORDER BY createdAt DESC
    LIMIT ? OFFSET ?
  `;
  values.push(parseInt(limit), parseInt(offset));

  const [rows] = await pool.query(sql, values);
  return { lists: rows, totalLists, currentPage: adjustedPage, totalPages };
};

// Get a single list by ID
const getListById = async (listId, userId) => {
  const sql = `
    SELECT id, listName as list_name, type, contacts_count as contactCount, createdAt, userId, description as list_description
    FROM lists
    WHERE id = ? AND userId = ?
  `;
  const [rows] = await pool.query(sql, [listId, userId]);
  return rows[0];
};

// Create a new list
const createList = async (userId, listName, description, type = 'General') => {
  const sql = `
    INSERT INTO lists (userId, listName, description, type, contacts_count)
    VALUES (?, ?, ?, ?, 0)
  `;
  const [result] = await pool.query(sql, [userId, listName, description, type]);
  return result;
};

// Update a list
const updateList = async (listId, userId, updates) => {
  const allowedFields = ['listName', 'description', 'type'];
  const setClause = [];
  const values = [];

  // Build dynamic SET clause
  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      setClause.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClause.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(listId, userId);
  const sql = `
    UPDATE lists
    SET ${setClause.join(', ')}
    WHERE id = ? AND userId = ?
  `;

  const [result] = await pool.query(sql, values);
  return result;
};

// Soft delete a list (mark as deleted instead of actually deleting)
const deleteList = async (listId, userId) => {
  const sql = `
    UPDATE lists
    SET is_deleted = TRUE, deleted_at = NOW()
    WHERE id = ? AND userId = ? AND (is_deleted = FALSE OR is_deleted IS NULL)
  `;
  const [result] = await pool.query(sql, [listId, userId]);
  return result;
};

// Hard delete a list (permanently remove from database)
const hardDeleteList = async (listId, userId) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // First delete all contacts in this list
    await connection.query('DELETE FROM contacts WHERE listId = ?', [listId]);

    // Then delete the list
    const [result] = await connection.query(
      'DELETE FROM lists WHERE id = ? AND userId = ?',
      [listId, userId]
    );

    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Restore a soft deleted list
const restoreList = async (listId, userId) => {
  const sql = `
    UPDATE lists
    SET is_deleted = FALSE, deleted_at = NULL
    WHERE id = ? AND userId = ? AND is_deleted = TRUE
  `;
  const [result] = await pool.query(sql, [listId, userId]);
  return result;
};

// Get list statistics
const getListStats = async (userId) => {
  const sql = `
    SELECT
      COUNT(*) as total_lists,
      SUM(contacts_count) as total_contacts,
      AVG(contacts_count) as avg_contacts_per_list,
      type,
      COUNT(*) as lists_by_type
    FROM lists
    WHERE userId = ?
    GROUP BY type
  `;
  const [rows] = await pool.query(sql, [userId]);
  return rows;
};

// Update contacts count for a list (manual trigger if needed)
const updateContactsCount = async (listId) => {
  const sql = `
    UPDATE lists
    SET contacts_count = (
      SELECT COUNT(*)
      FROM contacts
      WHERE listId = ?
    )
    WHERE id = ?
  `;
  const [result] = await pool.query(sql, [listId, listId]);
  return result;
};

module.exports = {
  getAllLists,
  getListById,
  createList,
  updateList,
  deleteList,
  getListStats,
  updateContactsCount
};
