const pool = require("../../config/DBConnection");

// Get all page permissions
const getAllPagePermissions = async () => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, required_permission,
      is_public, is_active, sort_order, icon, parent_page_id,
      created_at, updated_at
    FROM page_permissions 
    WHERE is_active = 1
    ORDER BY page_category, sort_order, page_name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get page permissions by category
const getPagePermissionsByCategory = async (category) => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, required_permission,
      is_public, is_active, sort_order, icon, parent_page_id,
      created_at, updated_at
    FROM page_permissions 
    WHERE page_category = ? AND is_active = 1
    ORDER BY sort_order, page_name
  `;
  const [rows] = await pool.execute(sql, [category]);
  return rows;
};

// Get page permission by ID
const getPagePermissionById = async (id) => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, required_permission,
      is_public, is_active, sort_order, icon, parent_page_id,
      created_at, updated_at
    FROM page_permissions 
    WHERE id = ?
  `;
  const [rows] = await pool.execute(sql, [id]);
  return rows[0];
};

// Get page permission by path
const getPagePermissionByPath = async (path) => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, required_permission,
      is_public, is_active, sort_order, icon, parent_page_id,
      created_at, updated_at
    FROM page_permissions 
    WHERE page_path = ? AND is_active = 1
  `;
  const [rows] = await pool.execute(sql, [path]);
  return rows[0];
};

// Create new page permission
const createPagePermission = async (pageData) => {
  const {
    page_path,
    page_name,
    page_category,
    required_permission,
    is_public = 0,
    sort_order = 0,
    icon,
    parent_page_id
  } = pageData;

  const sql = `
    INSERT INTO page_permissions (
      page_path, page_name, page_category, required_permission,
      is_public, sort_order, icon, parent_page_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  const [result] = await pool.execute(sql, [
    page_path, page_name, page_category, required_permission,
    is_public, sort_order, icon, parent_page_id
  ]);
  
  return result.insertId;
};

// Update page permission
const updatePagePermission = async (id, pageData) => {
  const {
    page_path,
    page_name,
    page_category,
    required_permission,
    is_public = 0,
    is_active = 1,
    sort_order = 0,
    icon,
    parent_page_id
  } = pageData;

  const sql = `
    UPDATE page_permissions 
    SET page_path = ?, page_name = ?, page_category = ?, required_permission = ?,
        is_public = ?, is_active = ?, sort_order = ?, icon = ?, parent_page_id = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;
  
  const [result] = await pool.execute(sql, [
    page_path, page_name, page_category, required_permission,
    is_public, is_active, sort_order, icon, parent_page_id, id
  ]);
  
  return result.affectedRows;
};

// Delete page permission (soft delete)
const deletePagePermission = async (id) => {
  const sql = `UPDATE page_permissions SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
  const [result] = await pool.execute(sql, [id]);
  return result.affectedRows;
};

// Get accessible pages for user based on their permissions
const getAccessiblePagesForUser = async (userId) => {
  const sql = `
    SELECT DISTINCT
      pp.id, pp.page_path, pp.page_name, pp.page_category, pp.required_permission,
      pp.is_public, pp.sort_order, pp.icon, pp.parent_page_id
    FROM page_permissions pp
    LEFT JOIN permissions p ON pp.required_permission = p.name
    LEFT JOIN role_permissions rp ON p.id = rp.permission_id
    LEFT JOIN users u ON u.role_id = rp.role_id
    LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
    WHERE pp.is_active = 1 
    AND (
      pp.is_public = 1 
      OR (u.id = ? AND rp.is_active = 1 AND p.is_active = 1)
      OR (up.user_id = ? AND up.granted = 1 AND up.is_active = 1 AND p.is_active = 1 
          AND (up.expires_at IS NULL OR up.expires_at > NOW()))
    )
    ORDER BY pp.page_category, pp.sort_order, pp.page_name
  `;
  const [rows] = await pool.execute(sql, [userId, userId, userId]);
  return rows;
};

// Check if user can access specific page
const canUserAccessPage = async (userId, pagePath) => {
  const sql = `
    SELECT pp.id
    FROM page_permissions pp
    LEFT JOIN permissions p ON pp.required_permission = p.name
    LEFT JOIN role_permissions rp ON p.id = rp.permission_id
    LEFT JOIN users u ON u.role_id = rp.role_id
    LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = ?
    WHERE pp.page_path = ? AND pp.is_active = 1 
    AND (
      pp.is_public = 1 
      OR (u.id = ? AND rp.is_active = 1 AND p.is_active = 1)
      OR (up.user_id = ? AND up.granted = 1 AND up.is_active = 1 AND p.is_active = 1 
          AND (up.expires_at IS NULL OR up.expires_at > NOW()))
    )
  `;
  const [rows] = await pool.execute(sql, [userId, pagePath, userId, userId]);
  return rows.length > 0;
};

// Get public pages
const getPublicPages = async () => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, required_permission,
      is_public, sort_order, icon, parent_page_id
    FROM page_permissions 
    WHERE is_public = 1 AND is_active = 1
    ORDER BY page_category, sort_order, page_name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

// Get pages by parent ID (for hierarchical navigation)
const getPagesByParentId = async (parentId) => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, required_permission,
      is_public, is_active, sort_order, icon, parent_page_id,
      created_at, updated_at
    FROM page_permissions 
    WHERE parent_page_id = ? AND is_active = 1
    ORDER BY sort_order, page_name
  `;
  const [rows] = await pool.execute(sql, [parentId]);
  return rows;
};

// Get root pages (pages without parent)
const getRootPages = async () => {
  const sql = `
    SELECT 
      id, page_path, page_name, page_category, required_permission,
      is_public, is_active, sort_order, icon, parent_page_id,
      created_at, updated_at
    FROM page_permissions 
    WHERE parent_page_id IS NULL AND is_active = 1
    ORDER BY sort_order, page_name
  `;
  const [rows] = await pool.execute(sql);
  return rows;
};

module.exports = {
  getAllPagePermissions,
  getPagePermissionsByCategory,
  getPagePermissionById,
  getPagePermissionByPath,
  createPagePermission,
  updatePagePermission,
  deletePagePermission,
  getAccessiblePagesForUser,
  canUserAccessPage,
  getPublicPages,
  getPagesByParentId,
  getRootPages
};
