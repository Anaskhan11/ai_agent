const pool = require('../config/DBConnection');

async function addTestPages() {
  try {
    console.log('🔧 Adding test pages for dynamic sidebar...\n');
    
    // Define test pages that should appear in the sidebar
    const testPages = [
      // Main pages
      { page_path: '/', page_name: 'Dashboard', page_category: 'main', icon: 'Home', sort_order: 1 },
      
      // Management pages
      { page_path: '/agents', page_name: 'Agents', page_category: 'management', icon: 'UserCog', sort_order: 10 },
      { page_path: '/models', page_name: 'Models', page_category: 'management', icon: 'Zap', sort_order: 11 },
      { page_path: '/voices', page_name: 'Voices', page_category: 'management', icon: 'Volume2', sort_order: 12 },
      { page_path: '/phone-numbers', page_name: 'Phone Numbers', page_category: 'management', icon: 'Phone', sort_order: 13 },
      
      // Campaign pages
      { page_path: '/outbound', page_name: 'Campaigns', page_category: 'campaigns', icon: 'Megaphone', sort_order: 20 },
      { page_path: '/workflows', page_name: 'Workflows', page_category: 'automation', icon: 'Workflow', sort_order: 30 },
      { page_path: '/webhooks', page_name: 'Webhooks', page_category: 'automation', icon: 'Waypoints', sort_order: 31 },
      
      // Contact pages
      { page_path: '/lists', page_name: 'Contacts', page_category: 'contacts', icon: 'List', sort_order: 40 },
      
      // Admin pages
      { page_path: '/users', page_name: 'User Management', page_category: 'admin', icon: 'Users', sort_order: 85 },
      { page_path: '/roles', page_name: 'Roles & Permissions', page_category: 'admin', icon: 'Shield', sort_order: 90 },
      
      // System pages
      { page_path: '/settings', page_name: 'Settings', page_category: 'system', icon: 'Settings', sort_order: 100 }
    ];
    
    console.log('1. Adding/updating pages in page_permissions table...');
    
    for (const page of testPages) {
      await pool.execute(`
        INSERT INTO page_permissions (page_path, page_name, page_category, icon, sort_order, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
          page_name = VALUES(page_name),
          page_category = VALUES(page_category),
          icon = VALUES(icon),
          sort_order = VALUES(sort_order),
          is_active = 1,
          updated_at = CURRENT_TIMESTAMP
      `, [page.page_path, page.page_name, page.page_category, page.icon, page.sort_order]);
    }
    
    console.log(`   ✅ Added/updated ${testPages.length} pages`);
    
    // 2. Ensure super_admin has access to all pages
    console.log('2. Ensuring super_admin has access to all pages...');
    
    const [superAdminRole] = await pool.execute("SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1");
    if (superAdminRole.length > 0) {
      const superAdminRoleId = superAdminRole[0].id;
      
      const [allPages] = await pool.execute('SELECT id FROM page_permissions WHERE is_active = 1');
      
      for (const page of allPages) {
        await pool.execute(`
          INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
          VALUES (?, ?, 1, 1, 1, 1, 1)
          ON DUPLICATE KEY UPDATE
            can_view = 1, can_add = 1, can_update = 1, can_delete = 1, updated_at = CURRENT_TIMESTAMP
        `, [superAdminRoleId, page.id]);
      }
      
      console.log(`   ✅ Super admin permissions updated for ${allPages.length} pages`);
    }
    
    // 3. Show current page permissions summary
    console.log('3. Current page permissions summary...');
    
    const [pageCount] = await pool.execute('SELECT COUNT(*) as count FROM page_permissions WHERE is_active = 1');
    const [permissionCount] = await pool.execute(`
      SELECT COUNT(*) as count FROM role_page_permissions rpp
      INNER JOIN roles r ON rpp.role_id = r.id
      WHERE r.name = 'super_admin' AND rpp.is_active = 1
    `);
    
    console.log(`   📊 Total active pages: ${pageCount[0].count}`);
    console.log(`   📊 Super admin page permissions: ${permissionCount[0].count}`);
    
    console.log('\n🎉 Test pages added successfully!');
    console.log('\n📋 What this means:');
    console.log('- All necessary pages are now in the database');
    console.log('- Super admin has full access to all pages');
    console.log('- Other roles have no permissions (must be assigned through portal)');
    console.log('\n🔧 Next steps:');
    console.log('1. Refresh your browser');
    console.log('2. Login as super admin - you should see all pages');
    console.log('3. Go to Role Permission Management');
    console.log('4. Assign specific pages to test roles');
    console.log('5. Test with non-super-admin users');
    
  } catch (error) {
    console.error('💥 Error adding test pages:', error);
  } finally {
    await pool.end();
  }
}

// Run the function if this script is executed directly
if (require.main === module) {
  addTestPages();
}

module.exports = addTestPages;
