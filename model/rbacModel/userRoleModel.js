const pool = require("../../config/DBConnection");

// Get all user roles
const getAllUserRoles = async () => {
  const sql = `
    SELECT 
      ur.id, ur.user_id, ur.role_id, ur.assigned_at, ur.assigned_by, 
      ur.is_active, ur.expires_at,
      u.username, u.email, u.first_name, u.last_name,
      r.name as role_name, r.display_name as role_display_name, r.description as role_description
    FROM user_roles ur
    INNER JOIN users u ON ur.user_id = u.id
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.is_active = 1
    ORDER BY u.username, r.name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get user roles by user ID
const getUserRolesByUserId = async (userId) => {
  const sql = `
    SELECT 
      ur.id, ur.user_id, ur.role_id, ur.assigned_at, ur.assigned_by, 
      ur.is_active, ur.expires_at,
      r.name as role_name, r.display_name as role_display_name, 
      r.description as role_description, r.is_system_role
    FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY r.name
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows;
};

// Get users by role ID
const getUsersByRoleId = async (roleId) => {
  const sql = `
    SELECT 
      u.id, u.username, u.email, u.first_name, u.last_name,
      ur.assigned_at, ur.assigned_by, ur.expires_at, ur.is_active
    FROM users u
    INNER JOIN user_roles ur ON u.id = ur.user_id
    WHERE ur.role_id = ? AND ur.is_active = 1
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    ORDER BY u.username
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows;
};

// Check if user has specific role
const checkUserRole = async (userId, roleName) => {
  const sql = `
    SELECT ur.id
    FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = ? AND r.name = ? AND ur.is_active = 1 AND r.is_active = 1
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
  `;
  const [rows] = await pool.execute(sql, [userId, roleName]);
  return rows.length > 0;
};

// Assign role to user
const assignRoleToUser = async (userId, roleId, assignedBy, expiresAt = null) => {
  // First check if the role is already assigned
  const existingRole = await getUserRoleByUserAndRole(userId, roleId);
  
  if (existingRole) {
    if (existingRole.is_active) {
      throw new Error('Role already assigned to this user');
    } else {
      // Reactivate existing role assignment
      const sql = `
        UPDATE user_roles 
        SET is_active = 1, assigned_at = CURRENT_TIMESTAMP, 
            assigned_by = ?, expires_at = ?
        WHERE user_id = ? AND role_id = ?
      `;
      const [result] = await pool.execute(sql, [assignedBy, expiresAt, userId, roleId]);
      return result.affectedRows;
    }
  } else {
    // Create new role assignment
    const sql = `
      INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [userId, roleId, assignedBy, expiresAt]);
    return result.insertId;
  }
};

// Remove role from user
const removeRoleFromUser = async (userId, roleId) => {
  const sql = `
    UPDATE user_roles 
    SET is_active = 0
    WHERE user_id = ? AND role_id = ?
  `;
  const [result] = await pool.execute(sql, [userId, roleId]);
  return result.affectedRows;
};

// Get specific user role
const getUserRoleByUserAndRole = async (userId, roleId) => {
  const sql = `
    SELECT 
      ur.id, ur.user_id, ur.role_id, ur.assigned_at, ur.assigned_by, 
      ur.is_active, ur.expires_at
    FROM user_roles ur
    WHERE ur.user_id = ? AND ur.role_id = ?
  `;
  const [rows] = await pool.execute(sql, [userId, roleId]);
  return rows[0];
};

// Bulk assign roles to user
const bulkAssignRolesToUser = async (userId, roleIds, assignedBy, expiresAt = null) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // First, deactivate all existing roles for this user
    await connection.execute(
      'UPDATE user_roles SET is_active = 0 WHERE user_id = ?',
      [userId]
    );
    
    // Then assign the new roles
    if (roleIds && roleIds.length > 0) {
      const values = roleIds.map(roleId => [userId, roleId, assignedBy, expiresAt]);
      const placeholders = roleIds.map(() => '(?, ?, ?, ?)').join(', ');
      
      const sql = `
        INSERT INTO user_roles (user_id, role_id, assigned_by, expires_at)
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE 
          is_active = 1, 
          assigned_at = CURRENT_TIMESTAMP, 
          assigned_by = VALUES(assigned_by),
          expires_at = VALUES(expires_at)
      `;
      
      const flatValues = values.flat();
      await connection.execute(sql, flatValues);
    }
    
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

// Get expired user roles
const getExpiredUserRoles = async () => {
  const sql = `
    SELECT 
      ur.id, ur.user_id, ur.role_id, ur.assigned_at, ur.assigned_by, 
      ur.expires_at, ur.is_active,
      u.username, u.email,
      r.name as role_name, r.display_name as role_display_name
    FROM user_roles ur
    INNER JOIN users u ON ur.user_id = u.id
    INNER JOIN roles r ON ur.role_id = r.id
    WHERE ur.expires_at IS NOT NULL AND ur.expires_at <= NOW() 
    AND ur.is_active = 1
    ORDER BY ur.expires_at DESC
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Clean up expired roles
const cleanupExpiredRoles = async () => {
  const sql = `
    UPDATE user_roles 
    SET is_active = 0
    WHERE expires_at IS NOT NULL AND expires_at <= NOW() 
    AND is_active = 1
  `;
  const [result] = await pool.execute(sql);
  return result.affectedRows;
};

// Delete all roles for a user
const deleteAllUserRoles = async (userId) => {
  const sql = `DELETE FROM user_roles WHERE user_id = ?`;
  const [result] = await pool.execute(sql, [userId]);
  return result.affectedRows;
};

// Get comprehensive user permissions (from roles and direct permissions)
const getUserComprehensivePermissions = async (userId) => {
  const sql = `
    SELECT DISTINCT p.name as permission_name, p.display_name, p.description, 
           p.category, p.resource, p.action, 'role' as source, r.name as source_name
    FROM user_roles ur
    INNER JOIN roles r ON ur.role_id = r.id
    INNER JOIN role_permissions rp ON r.id = rp.role_id
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = ? AND ur.is_active = 1 AND r.is_active = 1 
    AND p.is_active = 1 AND rp.is_active = 1
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    
    UNION
    
    SELECT DISTINCT p.name as permission_name, p.display_name, p.description, 
           p.category, p.resource, p.action, 'direct' as source, 'direct' as source_name
    FROM user_permissions up
    INNER JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = ? AND up.granted = 1 AND up.is_active = 1 
    AND p.is_active = 1
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
    
    ORDER BY category, resource, action
  `;
  const [rows] = await pool.execute(sql, [userId, userId]);
  return rows;
};

module.exports = {
  getAllUserRoles,
  getUserRolesByUserId,
  getUsersByRoleId,
  checkUserRole,
  assignRoleToUser,
  removeRoleFromUser,
  getUserRoleByUserAndRole,
  bulkAssignRolesToUser,
  getExpiredUserRoles,
  cleanupExpiredRoles,
  deleteAllUserRoles,
  getUserComprehensivePermissions
};
