const pool = require("../../config/DBConnection");

// Get all role page permissions
const getAllRolePagePermissions = async () => {
  const sql = `
    SELECT 
      rpp.id, rpp.role_id, rpp.page_id, rpp.can_view, rpp.can_add, 
      rpp.can_update, rpp.can_delete, rpp.is_active, rpp.created_at, rpp.updated_at,
      r.name as role_name, r.display_name as role_display_name,
      pp.page_path, pp.page_name, pp.page_category, pp.icon
    FROM role_page_permissions rpp
    INNER JOIN roles r ON rpp.role_id = r.id
    INNER JOIN page_permissions pp ON rpp.page_id = pp.id
    WHERE rpp.is_active = 1 AND r.is_active = 1 AND pp.is_active = 1
    ORDER BY r.name, pp.page_category, pp.sort_order, pp.page_name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get role page permissions by role ID
const getRolePagePermissionsByRoleId = async (roleId) => {
  const sql = `
    SELECT 
      rpp.id, rpp.role_id, rpp.page_id, rpp.can_view, rpp.can_add, 
      rpp.can_update, rpp.can_delete, rpp.is_active, rpp.created_at, rpp.updated_at,
      pp.page_path, pp.page_name, pp.page_category, pp.icon, pp.sort_order
    FROM role_page_permissions rpp
    INNER JOIN page_permissions pp ON rpp.page_id = pp.id
    WHERE rpp.role_id = ? AND rpp.is_active = 1 AND pp.is_active = 1
    ORDER BY pp.page_category, pp.sort_order, pp.page_name
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows;
};

// Get pages accessible by role
const getAccessiblePagesByRoleId = async (roleId) => {
  const sql = `
    SELECT DISTINCT
      pp.id, pp.page_path, pp.page_name, pp.page_category, pp.icon, pp.sort_order,
      rpp.can_view, rpp.can_add, rpp.can_update, rpp.can_delete
    FROM page_permissions pp
    LEFT JOIN role_page_permissions rpp ON pp.id = rpp.page_id AND rpp.role_id = ? AND rpp.is_active = 1
    WHERE pp.is_active = 1 AND (pp.is_public = 1 OR rpp.can_view = 1)
    ORDER BY pp.page_category, pp.sort_order, pp.page_name
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows;
};

// Set role page permissions (bulk update)
const setRolePagePermissions = async (roleId, pagePermissions, updatedBy) => {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();
    
    // First, deactivate all existing permissions for this role
    await connection.execute(
      'UPDATE role_page_permissions SET is_active = 0 WHERE role_id = ?',
      [roleId]
    );
    
    // Then insert/update the new permissions
    if (pagePermissions && pagePermissions.length > 0) {
      for (const permission of pagePermissions) {
        const { pageId, canView, canAdd, canUpdate, canDelete } = permission;
        
        // Check if permission already exists
        const [existing] = await connection.execute(
          'SELECT id FROM role_page_permissions WHERE role_id = ? AND page_id = ?',
          [roleId, pageId]
        );
        
        if (existing.length > 0) {
          // Update existing permission
          await connection.execute(`
            UPDATE role_page_permissions 
            SET can_view = ?, can_add = ?, can_update = ?, can_delete = ?, 
                is_active = 1, updated_at = CURRENT_TIMESTAMP, updated_by = ?
            WHERE role_id = ? AND page_id = ?
          `, [canView, canAdd, canUpdate, canDelete, updatedBy, roleId, pageId]);
        } else {
          // Insert new permission
          await connection.execute(`
            INSERT INTO role_page_permissions 
            (role_id, page_id, can_view, can_add, can_update, can_delete, created_by, updated_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [roleId, pageId, canView, canAdd, canUpdate, canDelete, updatedBy, updatedBy]);
        }
      }
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

// Check if role has specific page permission
const checkRolePagePermission = async (roleId, pageId, permissionType) => {
  const validPermissions = ['can_view', 'can_add', 'can_update', 'can_delete'];
  if (!validPermissions.includes(permissionType)) {
    throw new Error('Invalid permission type');
  }
  
  const sql = `
    SELECT ${permissionType}
    FROM role_page_permissions 
    WHERE role_id = ? AND page_id = ? AND is_active = 1
  `;
  const [rows] = await pool.execute(sql, [roleId, pageId]);
  return rows.length > 0 && rows[0][permissionType] === 1;
};

// Get user page permissions (through roles) - ONLY portal-assigned permissions
const getUserPagePermissions = async (userId) => {
  const sql = `
    SELECT DISTINCT
      pp.id, pp.page_path, pp.page_name, pp.page_category, pp.icon, pp.sort_order,
      MAX(rpp.can_view) as can_view,
      MAX(rpp.can_add) as can_add,
      MAX(rpp.can_update) as can_update,
      MAX(rpp.can_delete) as can_delete
    FROM page_permissions pp
    INNER JOIN role_page_permissions rpp ON pp.id = rpp.page_id AND rpp.is_active = 1
    INNER JOIN (
      -- Get user roles from both user_roles table and users.role_id
      SELECT DISTINCT role_id FROM user_roles
      WHERE user_id = ? AND is_active = 1
      UNION
      SELECT DISTINCT role_id FROM users
      WHERE id = ? AND role_id IS NOT NULL AND is_active = 1
    ) user_role_ids ON rpp.role_id = user_role_ids.role_id
    WHERE pp.is_active = 1 AND (
      pp.is_public = 1 OR
      (rpp.can_view = 1)
    )
    GROUP BY pp.id, pp.page_path, pp.page_name, pp.page_category, pp.icon, pp.sort_order
    ORDER BY pp.page_category, pp.sort_order, pp.page_name
  `;
  const [rows] = await pool.execute(sql, [userId, userId]);
  return rows;
};

// Get all pages for role permission management
const getAllPagesForRoleManagement = async () => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, icon, sort_order, is_public
    FROM page_permissions 
    WHERE is_active = 1
    ORDER BY page_category, sort_order, page_name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get role page permissions with page details
const getRolePagePermissionsWithDetails = async (roleId) => {
  const sql = `
    SELECT 
      pp.id as page_id, pp.page_path, pp.page_name, pp.page_category, pp.icon, pp.sort_order, pp.is_public,
      COALESCE(rpp.can_view, 0) as can_view,
      COALESCE(rpp.can_add, 0) as can_add,
      COALESCE(rpp.can_update, 0) as can_update,
      COALESCE(rpp.can_delete, 0) as can_delete,
      CASE WHEN rpp.id IS NOT NULL THEN 1 ELSE 0 END as has_permission
    FROM page_permissions pp
    LEFT JOIN role_page_permissions rpp ON pp.id = rpp.page_id AND rpp.role_id = ? AND rpp.is_active = 1
    WHERE pp.is_active = 1
    ORDER BY pp.page_category, pp.sort_order, pp.page_name
  `;
  const [rows] = await pool.execute(sql, [roleId]);
  return rows;
};

// Delete role page permission
const deleteRolePagePermission = async (roleId, pageId) => {
  const sql = `
    UPDATE role_page_permissions 
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ? AND page_id = ?
  `;
  const [result] = await pool.execute(sql, [roleId, pageId]);
  return result.affectedRows;
};

// Delete all role page permissions for a role
const deleteAllRolePagePermissions = async (roleId) => {
  const sql = `
    UPDATE role_page_permissions 
    SET is_active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE role_id = ?
  `;
  const [result] = await pool.execute(sql, [roleId]);
  return result.affectedRows;
};

module.exports = {
  getAllRolePagePermissions,
  getRolePagePermissionsByRoleId,
  getAccessiblePagesByRoleId,
  setRolePagePermissions,
  checkRolePagePermission,
  getUserPagePermissions,
  getAllPagesForRoleManagement,
  getRolePagePermissionsWithDetails,
  deleteRolePagePermission,
  deleteAllRolePagePermissions
};
