const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  reconnect: true,
  multipleStatements: true
});

async function addAuditPermissions() {
  try {
    console.log('🚀 Adding audit log permissions...');
    
    const connection = await pool.getConnection();
    
    // Add audit log permissions
    const permissionsSql = `
      INSERT INTO permissions (name, display_name, description, category, resource, action, is_active) VALUES
      ('audit_logs.view', 'View Audit Logs', 'View audit log entries', 'system', 'audit_logs', 'view', 1),
      ('audit_logs.export', 'Export Audit Logs', 'Export audit logs to Excel', 'system', 'audit_logs', 'export', 1),
      ('audit_logs.delete', 'Delete Audit Logs', 'Delete old audit log entries', 'system', 'audit_logs', 'delete', 1)
      ON DUPLICATE KEY UPDATE 
        display_name = VALUES(display_name),
        description = VALUES(description),
        category = VALUES(category),
        resource = VALUES(resource),
        action = VALUES(action);
    `;
    
    await connection.execute(permissionsSql);
    console.log('✅ Audit log permissions added successfully!');
    
    // Add audit logs page permission
    const pagePermissionSql = `
      INSERT INTO page_permissions (page_path, page_name, page_category, required_permission, is_public, sort_order, icon) VALUES
      ('/audit-logs', 'Audit Logs', 'system', 'audit_logs.view', 0, 95, 'FileText')
      ON DUPLICATE KEY UPDATE 
        page_name = VALUES(page_name),
        page_category = VALUES(page_category),
        required_permission = VALUES(required_permission),
        is_public = VALUES(is_public),
        sort_order = VALUES(sort_order),
        icon = VALUES(icon);
    `;
    
    await connection.execute(pagePermissionSql);
    console.log('✅ Audit logs page permission added successfully!');
    
    // Assign audit log permissions to super admin role
    const superAdminRoleSql = `
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.name = 'super_admin' 
      AND p.name IN ('audit_logs.view', 'audit_logs.export', 'audit_logs.delete')
      ON DUPLICATE KEY UPDATE role_id = VALUES(role_id);
    `;
    
    await connection.execute(superAdminRoleSql);
    console.log('✅ Audit log permissions assigned to super admin role!');
    
    // Assign audit logs page to super admin role
    const superAdminPageSql = `
      INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, is_active)
      SELECT r.id, pp.id, 1, 1, 1, 1, 1
      FROM roles r, page_permissions pp
      WHERE r.name = 'super_admin'
      AND pp.page_path = '/audit-logs'
      ON DUPLICATE KEY UPDATE
        can_view = VALUES(can_view),
        can_add = VALUES(can_add),
        can_update = VALUES(can_update),
        can_delete = VALUES(can_delete);
    `;
    
    await connection.execute(superAdminPageSql);
    console.log('✅ Audit logs page assigned to super admin role!');
    
    // Verify the permissions were added
    const [permissions] = await connection.execute(
      'SELECT * FROM permissions WHERE resource = "audit_logs"'
    );
    console.log('📋 Audit log permissions in database:');
    permissions.forEach(perm => {
      console.log(`  - ${perm.name}: ${perm.display_name}`);
    });
    
    const [pagePermissions] = await connection.execute(
      'SELECT * FROM page_permissions WHERE page_path = "/audit-logs"'
    );
    console.log('📋 Audit logs page permission:');
    pagePermissions.forEach(page => {
      console.log(`  - ${page.page_path}: ${page.page_name} (${page.required_permission})`);
    });
    
    connection.release();
    console.log('🎉 Audit log permissions setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error adding audit permissions:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the setup
addAuditPermissions().catch(console.error);
