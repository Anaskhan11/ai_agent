const pool = require("../../config/DBConnection");

// Get all lists for a user with pagination and search
const getAllLists = async (userId, page = 1, limit = 10, search = "", includeDeleted = false) => {
  let whereClause = "WHERE userId = ?";
  let values = [userId];

  // Check if is_deleted column exists and exclude deleted lists by default
  try {
    if (!includeDeleted) {
      // First check if the column exists
      const [columns] = await pool.query("SHOW COLUMNS FROM lists LIKE 'is_deleted'");
      if (columns.length > 0) {
        whereClause += " AND (is_deleted = FALSE OR is_deleted IS NULL)";
      }
    }
  } catch (error) {
    console.log("is_deleted column not found, skipping soft delete filter");
  }

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

  // Get paginated lists - check if soft delete columns exist
  let selectColumns = "id, listName as list_name, type, contacts_count as contactCount, createdAt, userId, description as list_description";

  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM lists LIKE 'is_deleted'");
    if (columns.length > 0) {
      selectColumns += ", is_deleted, deleted_at";
    }
  } catch (error) {
    console.log("Soft delete columns not found, using basic columns");
  }

  const sql = `
    SELECT ${selectColumns}
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
const getListById = async (listId, userId, includeDeleted = false) => {
  let whereClause = "WHERE id = ? AND userId = ?";
  let values = [listId, userId];

  // Check if is_deleted column exists and exclude deleted lists by default
  try {
    if (!includeDeleted) {
      const [columns] = await pool.query("SHOW COLUMNS FROM lists LIKE 'is_deleted'");
      if (columns.length > 0) {
        whereClause += " AND (is_deleted = FALSE OR is_deleted IS NULL)";
      }
    }
  } catch (error) {
    console.log("is_deleted column not found, skipping soft delete filter");
  }

  // Get list - check if soft delete columns exist
  let selectColumns = "id, listName as list_name, type, contacts_count as contactCount, createdAt, userId, description as list_description";

  try {
    const [columns] = await pool.query("SHOW COLUMNS FROM lists LIKE 'is_deleted'");
    if (columns.length > 0) {
      selectColumns += ", is_deleted, deleted_at";
    }
  } catch (error) {
    console.log("Soft delete columns not found, using basic columns");
  }

  const sql = `
    SELECT ${selectColumns}
    FROM lists
    ${whereClause}
  `;
  const [rows] = await pool.query(sql, values);
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
  try {
    // Check if soft delete columns exist
    const [columns] = await pool.query("SHOW COLUMNS FROM lists LIKE 'is_deleted'");
    if (columns.length > 0) {
      // Use soft delete
      const sql = `
        UPDATE lists
        SET is_deleted = TRUE, deleted_at = NOW()
        WHERE id = ? AND userId = ? AND (is_deleted = FALSE OR is_deleted IS NULL)
      `;
      const [result] = await pool.query(sql, [listId, userId]);
      return result;
    } else {
      // Fallback to hard delete if soft delete columns don't exist
      console.log("Soft delete columns not found, performing hard delete");
      return await hardDeleteList(listId, userId);
    }
  } catch (error) {
    console.error("Error in deleteList:", error);
    throw error;
  }
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
  try {
    // Check if soft delete columns exist
    const [columns] = await pool.query("SHOW COLUMNS FROM lists LIKE 'is_deleted'");
    if (columns.length > 0) {
      const sql = `
        UPDATE lists
        SET is_deleted = FALSE, deleted_at = NULL
        WHERE id = ? AND userId = ? AND is_deleted = TRUE
      `;
      const [result] = await pool.query(sql, [listId, userId]);
      return result;
    } else {
      // If soft delete columns don't exist, return error
      throw new Error("Soft delete functionality not available - columns not found");
    }
  } catch (error) {
    console.error("Error in restoreList:", error);
    throw error;
  }
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
  hardDeleteList,
  restoreList,
  getListStats,
  updateContactsCount
};
