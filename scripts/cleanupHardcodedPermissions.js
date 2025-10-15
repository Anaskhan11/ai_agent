const pool = require('../config/DBConnection');

async function cleanupHardcodedPermissions() {
  try {
    console.log('🧹 Cleaning up hardcoded role permissions to enable portal-only management...\n');
    
    // 1. Remove all existing role_page_permissions except for super_admin
    console.log('1. Removing hardcoded role page permissions (keeping super_admin)...');
    const [deleteResult] = await pool.execute(`
      DELETE FROM role_page_permissions 
      WHERE role_id NOT IN (
        SELECT id FROM roles WHERE name = 'super_admin'
      )
    `);
    console.log(`   ✅ Removed ${deleteResult.affectedRows} hardcoded permissions`);
    
    // 2. Remove hardcoded role permissions from role_permissions table (except super_admin)
    console.log('2. Removing hardcoded role permissions (keeping super_admin)...');
    const [deleteRolePerms] = await pool.execute(`
      DELETE FROM role_permissions 
      WHERE role_id NOT IN (
        SELECT id FROM roles WHERE name = 'super_admin'
      )
    `);
    console.log(`   ✅ Removed ${deleteRolePerms.affectedRows} hardcoded role permissions`);
    
    // 3. Ensure super_admin still has all permissions
    console.log('3. Ensuring super_admin has all permissions...');
    
    // Get super_admin role ID
    const [superAdminRole] = await pool.execute("SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1");
    if (superAdminRole.length > 0) {
      const superAdminRoleId = superAdminRole[0].id;
      
      // Give super_admin access to all pages
      const [allPages] = await pool.execute('SELECT id FROM page_permissions WHERE is_active = 1');
      
      for (const page of allPages) {
        await pool.execute(`
          INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
          VALUES (?, ?, 1, 1, 1, 1, 1)
          ON DUPLICATE KEY UPDATE
            can_view = 1, can_add = 1, can_update = 1, can_delete = 1, updated_at = CURRENT_TIMESTAMP
        `, [superAdminRoleId, page.id]);
      }
      
      // Give super_admin all permissions
      await pool.execute(`
        INSERT INTO role_permissions (role_id, permission_id, granted_by)
        SELECT ?, p.id, 1
        FROM permissions p
        ON DUPLICATE KEY UPDATE granted_at = CURRENT_TIMESTAMP
      `, [superAdminRoleId]);
      
      console.log(`   ✅ Super admin permissions updated`);
    }
    
    // 4. Verify the cleanup
    console.log('4. Verifying cleanup...');
    
    const [remainingPagePerms] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM role_page_permissions rpp
      INNER JOIN roles r ON rpp.role_id = r.id
      WHERE r.name != 'super_admin'
    `);
    
    const [remainingRolePerms] = await pool.execute(`
      SELECT COUNT(*) as count 
      FROM role_permissions rp
      INNER JOIN roles r ON rp.role_id = r.id
      WHERE r.name != 'super_admin'
    `);
    
    console.log(`   📊 Remaining non-super-admin page permissions: ${remainingPagePerms[0].count}`);
    console.log(`   📊 Remaining non-super-admin role permissions: ${remainingRolePerms[0].count}`);
    
    console.log('\n🎉 Cleanup completed successfully!');
    console.log('\n📋 What this means:');
    console.log('- All hardcoded permissions have been removed');
    console.log('- Only super_admin retains full access');
    console.log('- All other roles now have NO permissions by default');
    console.log('- You must assign permissions through the portal for all non-super-admin roles');
    console.log('\n🔧 Next steps:');
    console.log('1. Restart your backend server');
    console.log('2. Login as super admin');
    console.log('3. Go to Role Permission Management');
    console.log('4. Assign specific pages to each role as needed');
    console.log('5. Test with non-super-admin users');
    
  } catch (error) {
    console.error('💥 Error during cleanup:', error);
  } finally {
    await pool.end();
  }
}

// Run the cleanup function if this script is executed directly
if (require.main === module) {
  cleanupHardcodedPermissions();
}

module.exports = cleanupHardcodedPermissions;
