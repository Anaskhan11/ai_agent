const pool = require("../../config/DBConnection");

// Get all clinical roles
const getAllClinicalRoles = async () => {
  const sql = `
    SELECT 
      id, name, display_name, description, permissions, hierarchy_level,
      is_system_role, is_active, created_at, updated_at
    FROM clinical_roles 
    WHERE is_active = 1
    ORDER BY hierarchy_level DESC, display_name ASC
  `;
  const [rows] = await pool.execute(sql);
  
  // Handle permissions (already parsed by MySQL JSON column type)
  return rows.map(role => ({
    ...role,
    permissions: role.permissions || { view: [], add: [], update: [], delete: [] }
  }));
};

// Get clinical role by ID
const getClinicalRoleById = async (id) => {
  const sql = `
    SELECT 
      id, name, display_name, description, permissions, hierarchy_level,
      is_system_role, is_active, created_at, updated_at
    FROM clinical_roles 
    WHERE id = ? AND is_active = 1
  `;
  const [rows] = await pool.execute(sql, [id]);
  
  if (rows.length === 0) return null;
  
  const role = rows[0];
  return {
    ...role,
    permissions: role.permissions || { view: [], add: [], update: [], delete: [] }
  };
};

// Get clinical role by name
const getClinicalRoleByName = async (name) => {
  const sql = `
    SELECT 
      id, name, display_name, description, permissions, hierarchy_level,
      is_system_role, is_active, created_at, updated_at
    FROM clinical_roles 
    WHERE name = ? AND is_active = 1
  `;
  const [rows] = await pool.execute(sql, [name]);
  
  if (rows.length === 0) return null;
  
  const role = rows[0];
  return {
    ...role,
    permissions: role.permissions || { view: [], add: [], update: [], delete: [] }
  };
};

// Create new clinical role
const createClinicalRole = async (roleData) => {
  const {
    name,
    display_name,
    description,
    permissions,
    hierarchy_level = 5,
    is_system_role = 0
  } = roleData;

  const sql = `
    INSERT INTO clinical_roles (
      name, display_name, description, permissions, hierarchy_level, is_system_role, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, 1)
  `;
  
  const permissionsJson = JSON.stringify(permissions);
  const [result] = await pool.execute(sql, [
    name, display_name, description, permissionsJson, hierarchy_level, is_system_role
  ]);
  
  return result.insertId;
};

// Update clinical role
const updateClinicalRole = async (id, roleData) => {
  const {
    name,
    display_name,
    description,
    permissions,
    hierarchy_level
  } = roleData;

  const sql = `
    UPDATE clinical_roles 
    SET name = ?, display_name = ?, description = ?, permissions = ?, 
        hierarchy_level = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND is_active = 1
  `;
  
  const permissionsJson = JSON.stringify(permissions);
  const [result] = await pool.execute(sql, [
    name, display_name, description, permissionsJson, hierarchy_level, id
  ]);
  
  return result.affectedRows > 0;
};

// Delete clinical role (soft delete)
const deleteClinicalRole = async (id) => {
  const sql = `
    UPDATE clinical_roles 
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND is_system_role = 0
  `;
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows > 0;
};

// Get users assigned to a clinical role
const getUsersWithClinicalRole = async (roleId) => {
  const sql = `
    SELECT 
      u.id, u.username, u.email, u.first_name, u.last_name,
      ucr.assigned_at, ucr.expires_at, ucr.is_active
    FROM users u
    INNER JOIN user_clinical_roles ucr ON u.id = ucr.user_id
    WHERE ucr.clinical_role_id = ? AND ucr.is_active = 1
    ORDER BY u.first_name, u.last_name
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows;
};

// Assign clinical role to user
const assignClinicalRoleToUser = async (userId, roleId, assignedBy, expiresAt = null) => {
  const sql = `
    INSERT INTO user_clinical_roles (user_id, clinical_role_id, assigned_by, expires_at, is_active)
    VALUES (?, ?, ?, ?, 1)
    ON DUPLICATE KEY UPDATE
      assigned_by = VALUES(assigned_by),
      expires_at = VALUES(expires_at),
      is_active = 1,
      assigned_at = CURRENT_TIMESTAMP
  `;
  const [result] = await pool.execute(sql, [userId, roleId, assignedBy, expiresAt]);
  return result.insertId || result.affectedRows > 0;
};

// Remove clinical role from user
const removeClinicalRoleFromUser = async (userId, roleId) => {
  const sql = `
    UPDATE user_clinical_roles 
    SET is_active = 0
    WHERE user_id = ? AND clinical_role_id = ?
  `;
  const [result] = await pool.execute(sql, [userId, roleId]);
  return result.affectedRows > 0;
};

// Get user's clinical roles
const getUserClinicalRoles = async (userId) => {
  const sql = `
    SELECT 
      cr.id, cr.name, cr.display_name, cr.description, cr.permissions, 
      cr.hierarchy_level, ucr.assigned_at, ucr.expires_at
    FROM clinical_roles cr
    INNER JOIN user_clinical_roles ucr ON cr.id = ucr.clinical_role_id
    WHERE ucr.user_id = ? AND ucr.is_active = 1 AND cr.is_active = 1
    AND (ucr.expires_at IS NULL OR ucr.expires_at > NOW())
    ORDER BY cr.hierarchy_level DESC
  `;
  const [rows] = await pool.execute(sql, [userId]);
  
  return rows.map(role => ({
    ...role,
    permissions: role.permissions || { view: [], add: [], update: [], delete: [] }
  }));
};

// Check if user has specific clinical role
const userHasClinicalRole = async (userId, roleName) => {
  const sql = `
    SELECT 1
    FROM clinical_roles cr
    INNER JOIN user_clinical_roles ucr ON cr.id = ucr.clinical_role_id
    WHERE ucr.user_id = ? AND cr.name = ? AND ucr.is_active = 1 AND cr.is_active = 1
    AND (ucr.expires_at IS NULL OR ucr.expires_at > NOW())
  `;
  const [rows] = await pool.execute(sql, [userId, roleName]);
  return rows.length > 0;
};

// Get clinical role statistics
const getClinicalRoleStats = async () => {
  const sql = `
    SELECT 
      COUNT(*) as total_roles,
      SUM(CASE WHEN is_system_role = 1 THEN 1 ELSE 0 END) as system_roles,
      SUM(CASE WHEN is_system_role = 0 THEN 1 ELSE 0 END) as custom_roles,
      (SELECT COUNT(DISTINCT user_id) FROM user_clinical_roles WHERE is_active = 1) as users_with_roles
    FROM clinical_roles 
    WHERE is_active = 1
  `;
  const [rows] = await pool.execute(sql);
  return rows[0];
};

module.exports = {
  getAllClinicalRoles,
  getClinicalRoleById,
  getClinicalRoleByName,
  createClinicalRole,
  updateClinicalRole,
  deleteClinicalRole,
  getUsersWithClinicalRole,
  assignClinicalRoleToUser,
  removeClinicalRoleFromUser,
  getUserClinicalRoles,
  userHasClinicalRole,
  getClinicalRoleStats
};
