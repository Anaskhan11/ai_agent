const pool = require("../../config/DBConnection");

// Get all user permissions
const getAllUserPermissions = async () => {
  const sql = `
    SELECT 
      up.id, up.user_id, up.permission_id, up.granted, up.granted_at, 
      up.granted_by, up.expires_at, up.reason, up.is_active,
      u.username, u.email, u.first_name, u.last_name,
      p.name as permission_name, p.display_name as permission_display_name,
      p.category, p.resource, p.action
    FROM user_permissions up
    INNER JOIN users u ON up.user_id = u.id
    INNER JOIN permissions p ON up.permission_id = p.id
    WHERE up.is_active = 1
    ORDER BY u.username, p.category, p.resource, p.action
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get user permissions by user ID
const getUserPermissionsByUserId = async (userId) => {
  const sql = `
    SELECT 
      up.id, up.user_id, up.permission_id, up.granted, up.granted_at, 
      up.granted_by, up.expires_at, up.reason, up.is_active,
      p.name as permission_name, p.display_name as permission_display_name,
      p.category, p.resource, p.action, p.description
    FROM user_permissions up
    INNER JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = ? AND up.is_active = 1 AND p.is_active = 1
    ORDER BY p.category, p.resource, p.action
  `;
  const [rows] = await pool.execute(sql, [userId]);
  return rows;
};

// Check if user has specific permission (direct permission, not role-based)
const checkUserPermission = async (userId, permissionName) => {
  const sql = `
    SELECT up.id
    FROM user_permissions up
    INNER JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = ? AND p.name = ? AND up.granted = 1 
    AND up.is_active = 1 AND p.is_active = 1
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
  `;
  const [rows] = await pool.execute(sql, [userId, permissionName]);
  return rows.length > 0;
};

// Grant permission to user
const grantPermissionToUser = async (userId, permissionId, grantedBy, expiresAt = null, reason = null) => {
  // First check if the permission is already granted
  const existingPermission = await getUserPermissionByUserAndPermission(userId, permissionId);
  
  if (existingPermission) {
    if (existingPermission.granted && existingPermission.is_active) {
      throw new Error('Permission already granted to this user');
    } else {
      // Update existing permission
      const sql = `
        UPDATE user_permissions 
        SET granted = 1, is_active = 1, granted_at = CURRENT_TIMESTAMP, 
            granted_by = ?, expires_at = ?, reason = ?
        WHERE user_id = ? AND permission_id = ?
      `;
      const [result] = await pool.execute(sql, [grantedBy, expiresAt, reason, userId, permissionId]);
      return result.affectedRows;
    }
  } else {
    // Create new permission grant
    const sql = `
      INSERT INTO user_permissions (user_id, permission_id, granted, granted_by, expires_at, reason)
      VALUES (?, ?, 1, ?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [userId, permissionId, grantedBy, expiresAt, reason]);
    return result.insertId;
  }
};

// Revoke permission from user
const revokePermissionFromUser = async (userId, permissionId, reason = null) => {
  const sql = `
    UPDATE user_permissions 
    SET granted = 0, reason = ?
    WHERE user_id = ? AND permission_id = ?
  `;
  const [result] = await pool.execute(sql, [reason, userId, permissionId]);
  return result.affectedRows;
};

// Get specific user permission
const getUserPermissionByUserAndPermission = async (userId, permissionId) => {
  const sql = `
    SELECT 
      up.id, up.user_id, up.permission_id, up.granted, up.granted_at, 
      up.granted_by, up.expires_at, up.reason, up.is_active
    FROM user_permissions up
    WHERE up.user_id = ? AND up.permission_id = ?
  `;
  const [rows] = await pool.execute(sql, [userId, permissionId]);
  return rows[0];
};

// Bulk grant permissions to user
const bulkGrantPermissionsToUser = async (userId, permissionIds, grantedBy, expiresAt = null, reason = null) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // First, revoke all existing permissions for this user
    await connection.execute(
      'UPDATE user_permissions SET granted = 0, is_active = 0 WHERE user_id = ?',
      [userId]
    );
    
    // Then grant the new permissions
    if (permissionIds && permissionIds.length > 0) {
      const values = permissionIds.map(permissionId => [userId, permissionId, 1, grantedBy, expiresAt, reason]);
      const placeholders = permissionIds.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      
      const sql = `
        INSERT INTO user_permissions (user_id, permission_id, granted, granted_by, expires_at, reason)
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE 
          granted = VALUES(granted),
          is_active = 1, 
          granted_at = CURRENT_TIMESTAMP, 
          granted_by = VALUES(granted_by),
          expires_at = VALUES(expires_at),
          reason = VALUES(reason)
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

// Get users with specific permission
const getUsersWithPermission = async (permissionId) => {
  const sql = `
    SELECT 
      u.id, u.username, u.email, u.first_name, u.last_name,
      up.granted, up.granted_at, up.granted_by, up.expires_at, up.reason, up.is_active
    FROM users u
    INNER JOIN user_permissions up ON u.id = up.user_id
    WHERE up.permission_id = ? AND up.granted = 1 AND up.is_active = 1
    AND (up.expires_at IS NULL OR up.expires_at > NOW())
    ORDER BY u.username
  `;
  const [rows] = await pool.execute(sql, [permissionId]);
  return rows;
};

// Get expired user permissions
const getExpiredUserPermissions = async () => {
  const sql = `
    SELECT 
      up.id, up.user_id, up.permission_id, up.granted, up.granted_at, 
      up.granted_by, up.expires_at, up.reason, up.is_active,
      u.username, u.email,
      p.name as permission_name, p.display_name as permission_display_name
    FROM user_permissions up
    INNER JOIN users u ON up.user_id = u.id
    INNER JOIN permissions p ON up.permission_id = p.id
    WHERE up.expires_at IS NOT NULL AND up.expires_at <= NOW() 
    AND up.granted = 1 AND up.is_active = 1
    ORDER BY up.expires_at DESC
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Clean up expired permissions
const cleanupExpiredPermissions = async () => {
  const sql = `
    UPDATE user_permissions 
    SET granted = 0, is_active = 0
    WHERE expires_at IS NOT NULL AND expires_at <= NOW() 
    AND granted = 1 AND is_active = 1
  `;
  const [result] = await pool.execute(sql);
  return result.affectedRows;
};

// Delete all permissions for a user
const deleteAllUserPermissions = async (userId) => {
  const sql = `DELETE FROM user_permissions WHERE user_id = ?`;
  const [result] = await pool.execute(sql, [userId]);
  return result.affectedRows;
};

module.exports = {
  getAllUserPermissions,
  getUserPermissionsByUserId,
  checkUserPermission,
  grantPermissionToUser,
  revokePermissionFromUser,
  getUserPermissionByUserAndPermission,
  bulkGrantPermissionsToUser,
  getUsersWithPermission,
  getExpiredUserPermissions,
  cleanupExpiredPermissions,
  deleteAllUserPermissions
};
