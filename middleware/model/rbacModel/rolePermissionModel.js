const pool = require("../../config/DBConnection");

// Get all role permissions
const getAllRolePermissions = async () => {
  const sql = `
    SELECT 
      rp.id, rp.role_id, rp.permission_id, rp.granted_at, rp.granted_by, rp.is_active,
      r.name as role_name, r.display_name as role_display_name,
      p.name as permission_name, p.display_name as permission_display_name,
      p.category, p.resource, p.action
    FROM role_permissions rp
    INNER JOIN roles r ON rp.role_id = r.id
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.is_active = 1
    ORDER BY r.name, p.category, p.resource, p.action
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get role permissions by role ID
const getRolePermissionsByRoleId = async (roleId) => {
  const sql = `
    SELECT 
      rp.id, rp.role_id, rp.permission_id, rp.granted_at, rp.granted_by, rp.is_active,
      p.name as permission_name, p.display_name as permission_display_name,
      p.category, p.resource, p.action, p.description
    FROM role_permissions rp
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = ? AND rp.is_active = 1 AND p.is_active = 1
    ORDER BY p.category, p.resource, p.action
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows;
};

// Check if role has specific permission
const checkRolePermission = async (roleId, permissionName) => {
  const sql = `
    SELECT rp.id
    FROM role_permissions rp
    INNER JOIN permissions p ON rp.permission_id = p.id
    WHERE rp.role_id = ? AND p.name = ? AND rp.is_active = 1 AND p.is_active = 1
  `;
  const [rows] = await pool.execute(sql, [roleId, permissionName]);
  return rows.length > 0;
};

// Grant permission to role
const grantPermissionToRole = async (roleId, permissionId, grantedBy) => {
  // First check if the permission is already granted
  const existingPermission = await getRolePermissionByRoleAndPermission(roleId, permissionId);
  
  if (existingPermission) {
    if (existingPermission.is_active) {
      throw new Error('Permission already granted to this role');
    } else {
      // Reactivate the permission
      const sql = `
        UPDATE role_permissions 
        SET is_active = 1, granted_at = CURRENT_TIMESTAMP, granted_by = ?
        WHERE role_id = ? AND permission_id = ?
      `;
      const [result] = await pool.execute(sql, [grantedBy, roleId, permissionId]);
      return result.affectedRows;
    }
  } else {
    // Create new permission grant
    const sql = `
      INSERT INTO role_permissions (role_id, permission_id, granted_by)
      VALUES (?, ?, ?)
    `;
    const [result] = await pool.execute(sql, [roleId, permissionId, grantedBy]);
    return result.insertId;
  }
};

// Revoke permission from role
const revokePermissionFromRole = async (roleId, permissionId) => {
  const sql = `
    UPDATE role_permissions 
    SET is_active = 0
    WHERE role_id = ? AND permission_id = ?
  `;
  const [result] = await pool.execute(sql, [roleId, permissionId]);
  return result.affectedRows;
};

// Get specific role permission
const getRolePermissionByRoleAndPermission = async (roleId, permissionId) => {
  const sql = `
    SELECT 
      rp.id, rp.role_id, rp.permission_id, rp.granted_at, rp.granted_by, rp.is_active
    FROM role_permissions rp
    WHERE rp.role_id = ? AND rp.permission_id = ?
  `;
  const [rows] = await pool.execute(sql, [roleId, permissionId]);
  return rows[0];
};

// Bulk grant permissions to role
const bulkGrantPermissionsToRole = async (roleId, permissionIds, grantedBy) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // First, revoke all existing permissions for this role
    await connection.execute(
      'UPDATE role_permissions SET is_active = 0 WHERE role_id = ?',
      [roleId]
    );
    
    // Then grant the new permissions
    if (permissionIds && permissionIds.length > 0) {
      const values = permissionIds.map(permissionId => [roleId, permissionId, grantedBy]);
      const placeholders = permissionIds.map(() => '(?, ?, ?)').join(', ');
      
      const sql = `
        INSERT INTO role_permissions (role_id, permission_id, granted_by)
        VALUES ${placeholders}
        ON DUPLICATE KEY UPDATE 
          is_active = 1, 
          granted_at = CURRENT_TIMESTAMP, 
          granted_by = VALUES(granted_by)
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

// Get roles with specific permission
const getRolesWithPermission = async (permissionId) => {
  const sql = `
    SELECT 
      r.id, r.name, r.display_name, r.description,
      rp.granted_at, rp.granted_by, rp.is_active
    FROM roles r
    INNER JOIN role_permissions rp ON r.id = rp.role_id
    WHERE rp.permission_id = ? AND rp.is_active = 1 AND r.is_active = 1
    ORDER BY r.name
  `;
  const [rows] = await pool.execute(sql, [permissionId]);
  return rows;
};

// Delete all permissions for a role
const deleteAllRolePermissions = async (roleId) => {
  const sql = `DELETE FROM role_permissions WHERE role_id = ?`;
  const [result] = await pool.execute(sql, [roleId]);
  return result.affectedRows;
};

module.exports = {
  getAllRolePermissions,
  getRolePermissionsByRoleId,
  checkRolePermission,
  grantPermissionToRole,
  revokePermissionFromRole,
  getRolePermissionByRoleAndPermission,
  bulkGrantPermissionsToRole,
  getRolesWithPermission,
  deleteAllRolePermissions
};
