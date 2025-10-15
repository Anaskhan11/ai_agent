const pool = require("../../config/DBConnection");

// Create a new role
const createRole = async (role) => {
  const {
    name,
    display_name,
    description,
    is_system_role = 0
  } = role;

  const sql = `
    INSERT INTO roles (name, display_name, description, is_system_role)
    VALUES (?, ?, ?, ?)
  `;
  const [result] = await pool.execute(sql, [name, display_name, description, is_system_role]);
  return result.insertId;
};

// Find a role by ID
const findRoleById = async (id) => {
  const sql = `
    SELECT
      id, name, display_name, description,
      is_system_role, is_active, created_at, updated_at
    FROM roles
    WHERE id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0];
};

// Find a role by name
const findRoleByName = async (name) => {
  const sql = `SELECT * FROM roles WHERE name = ?`;
  const [rows] = await pool.execute(sql, [name]);
  return rows[0];
};

// Get all roles
const getAllRoles = async () => {
  const sql = `
    SELECT
      id, name, display_name, description,
      is_system_role, is_active, created_at, updated_at
    FROM roles
    WHERE is_active = 1
    ORDER BY name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Update a role
const updateRole = async (id, role) => {
  const {
    name,
    display_name,
    description,
    is_active = 1
  } = role;

  const sql = `
    UPDATE roles
    SET name = ?, display_name = ?, description = ?,
        is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  const [result] = await pool.execute(sql, [name, display_name, description, is_active, id]);
  return result.affectedRows;
};

// Delete a role (soft delete)
const deleteRole = async (id) => {
  const sql = `UPDATE roles SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows;
};

// Get system roles
const getSystemRoles = async () => {
  const sql = `
    SELECT
      id, name, display_name, description,
      is_system_role, is_active, created_at, updated_at
    FROM roles
    WHERE is_system_role = 1 AND is_active = 1
    ORDER BY name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get custom roles
const getCustomRoles = async () => {
  const sql = `
    SELECT
      id, name, display_name, description,
      is_system_role, is_active, created_at, updated_at
    FROM roles
    WHERE is_system_role = 0 AND is_active = 1
    ORDER BY name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Check if role is super admin
const isSuperAdminRole = async (roleId) => {
  const sql = `
    SELECT id FROM roles
    WHERE id = ? AND (name = 'super_admin' OR id = 1) AND is_active = 1
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows.length > 0;
};

// Get user count for role
const getUserCountForRole = async (roleId) => {
  const sql = `SELECT COUNT(*) as user_count FROM users WHERE role_id = ?`;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows[0].user_count;
};

// Export all functions
module.exports = {
  createRole,
  findRoleById,
  findRoleByName,
  getAllRoles,
  updateRole,
  deleteRole,
  getSystemRoles,
  getCustomRoles,
  isSuperAdminRole,
  getUserCountForRole
};
