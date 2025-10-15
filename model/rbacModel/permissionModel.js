const pool = require("../../config/DBConnection");

// Get all permissions
const getAllPermissions = async () => {
  const sql = `
    SELECT 
      id, name, display_name, description, category, resource, action,
      is_system_permission, is_active, created_at, updated_at
    FROM permissions 
    WHERE is_active = 1
    ORDER BY category, resource, action
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get permissions by category
const getPermissionsByCategory = async (category) => {
  const sql = `
    SELECT 
      id, name, display_name, description, category, resource, action,
      is_system_permission, is_active, created_at, updated_at
    FROM permissions 
    WHERE category = ? AND is_active = 1
    ORDER BY resource, action
  `;
  const [rows] = await pool.execute(sql, [category]);
  return rows;
};

// Get permission by ID
const getPermissionById = async (id) => {
  const sql = `
    SELECT 
      id, name, display_name, description, category, resource, action,
      is_system_permission, is_active, created_at, updated_at
    FROM permissions 
    WHERE id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0];
};

// Get permission by name
const getPermissionByName = async (name) => {
  const sql = `
    SELECT 
      id, name, display_name, description, category, resource, action,
      is_system_permission, is_active, created_at, updated_at
    FROM permissions 
    WHERE name = ?
  `;
  const [rows] = await pool.execute(sql, [name]);
  return rows[0];
};

// Create new permission
const createPermission = async (permissionData) => {
  const {
    name,
    display_name,
    description,
    category,
    resource,
    action,
    is_system_permission = 0
  } = permissionData;

  const sql = `
    INSERT INTO permissions (
      name, display_name, description, category, resource, action, is_system_permission
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  
  const [result] = await pool.execute(sql, [
    name, display_name, description, category, resource, action, is_system_permission
  ]);
  
  return result.insertId;
};

// Update permission
const updatePermission = async (id, permissionData) => {
  const {
    name,
    display_name,
    description,
    category,
    resource,
    action,
    is_active = 1
  } = permissionData;

  const sql = `
    UPDATE permissions 
    SET name = ?, display_name = ?, description = ?, category = ?, 
        resource = ?, action = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  const [result] = await pool.execute(sql, [
    name, display_name, description, category, resource, action, is_active, id
  ]);
  
  return result.affectedRows;
};

// Delete permission (soft delete)
const deletePermission = async (id) => {
  const sql = `UPDATE permissions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows;
};

// Get permissions for a specific role
const getPermissionsByRoleId = async (roleId) => {
  const sql = `
    SELECT 
      p.id, p.name, p.display_name, p.description, p.category, 
      p.resource, p.action, p.is_system_permission,
      rp.granted_at, rp.granted_by, rp.is_active as role_permission_active
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    WHERE rp.role_id = ? AND rp.is_active = 1 AND p.is_active = 1
    ORDER BY p.category, p.resource, p.action
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows;
};

// Get permissions for a specific user (including role permissions and direct user permissions)
const getPermissionsByUserId = async (userId) => {
  const sql = `
    SELECT DISTINCT
      p.id, p.name, p.display_name, p.description, p.category, 
      p.resource, p.action, p.is_system_permission,
      'role' as permission_source
    FROM permissions p
    INNER JOIN role_permissions rp ON p.id = rp.permission_id
    INNER JOIN users u ON u.role_id = rp.role_id
    WHERE u.id = ? AND rp.is_active = 1 AND p.is_active = 1
    
    UNION
    
    SELECT DISTINCT
      p.id, p.name, p.display_name, p.description, p.category, 
      p.resource, p.action, p.is_system_permission,
      'direct' as permission_source
    FROM permissions p
    INNER JOIN user_permissions up ON p.id = up.permission_id
    WHERE up.user_id = ? AND up.granted = 1 AND up.is_active = 1 AND p.is_active = 1
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
    
    ORDER BY category, resource, action
  `;
  const [rows] = await pool.execute(sql, [userId, userId]);
  return rows;
};

module.exports = {
  getAllPermissions,
  getPermissionsByCategory,
  getPermissionById,
  getPermissionByName,
  createPermission,
  updatePermission,
  deletePermission,
  getPermissionsByRoleId,
  getPermissionsByUserId
};
