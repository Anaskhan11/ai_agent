const pool = require('../config/DBConnection');

// Define all sidebar pages that should be in the database
const sidebarPages = [
  // Main pages
  { page_path: '/', page_name: 'Dashboard', page_category: 'main', icon: 'Home', sort_order: 1, is_public: true },
  
  // Management pages
  { page_path: '/agents', page_name: 'Agents', page_category: 'management', icon: 'UserCog', sort_order: 10 },
  { page_path: '/models', page_name: 'Models', page_category: 'management', icon: 'Zap', sort_order: 11 },
  { page_path: '/voices', page_name: 'Voices', page_category: 'management', icon: 'Volume2', sort_order: 12 },
  { page_path: '/phone-numbers', page_name: 'Phone Numbers', page_category: 'management', icon: 'Phone', sort_order: 13 },
  
  // Campaign pages
  { page_path: '/outbound', page_name: 'Campaign', page_category: 'campaigns', icon: 'Megaphone', sort_order: 20 },
  
  // Automation pages
  { page_path: '/workflows', page_name: 'Workflows', page_category: 'automation', icon: 'Workflow', sort_order: 30 },
  { page_path: '/webhooks', page_name: 'Webhooks', page_category: 'automation', icon: 'Webhook', sort_order: 31 },
  
  // Contact pages
  { page_path: '/lists', page_name: 'Contacts', page_category: 'contacts', icon: 'List', sort_order: 40 },
  
  // Content pages
  { page_path: '/knowledge-bases', page_name: 'Knowledge Bases', page_category: 'content', icon: 'Book', sort_order: 50 },
  { page_path: '/actions', page_name: 'Actions', page_category: 'automation', icon: 'Waypoints', sort_order: 51 },
  { page_path: '/recordings', page_name: 'Recordings', page_category: 'content', icon: 'CassetteTape', sort_order: 52 },
  
  // Help pages
  { page_path: '/support', page_name: 'Support', page_category: 'help', icon: 'MessageCircleQuestion', sort_order: 60 },
  { page_path: '/admin-support', page_name: 'Admin Support', page_category: 'admin', icon: 'Shield', sort_order: 50, is_admin_only: true },
  
  // Admin pages
  { page_path: '/roles', page_name: 'Roles & Permissions', page_category: 'admin', icon: 'Shield', sort_order: 70 },
  
  // User pages
  { page_path: '/settings', page_name: 'Settings', page_category: 'user', icon: 'Settings', sort_order: 80 }
];

async function addSidebarPages() {
  console.log('🔄 Adding/updating sidebar pages in database...\n');

  try {
    // Check existing pages
    const [existingPages] = await pool.execute('SELECT page_path FROM page_permissions');
    const existingPaths = existingPages.map(p => p.page_path);
    
    console.log(`📋 Found ${existingPages.length} existing pages in database`);
    console.log(`📋 Need to process ${sidebarPages.length} sidebar pages\n`);

    let addedCount = 0;
    let updatedCount = 0;

    for (const page of sidebarPages) {
      const { page_path, page_name, page_category, icon, sort_order, is_public = false } = page;
      
      if (existingPaths.includes(page_path)) {
        // Update existing page
        await pool.execute(`
          UPDATE page_permissions 
          SET page_name = ?, page_category = ?, icon = ?, sort_order = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
          WHERE page_path = ?
        `, [page_name, page_category, icon, sort_order, is_public ? 1 : 0, page_path]);
        
        console.log(`✅ Updated: ${page_name} (${page_path})`);
        updatedCount++;
      } else {
        // Add new page
        await pool.execute(`
          INSERT INTO page_permissions (page_path, page_name, page_category, icon, sort_order, is_public)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [page_path, page_name, page_category, icon, sort_order, is_public ? 1 : 0]);
        
        console.log(`➕ Added: ${page_name} (${page_path})`);
        addedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   - Added: ${addedCount} pages`);
    console.log(`   - Updated: ${updatedCount} pages`);
    console.log(`   - Total sidebar pages: ${sidebarPages.length}`);

    // Now update role permissions for super admin to have access to all pages
    console.log('\n🔄 Updating super admin permissions...');
    
    const [superAdminRole] = await pool.execute("SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1");
    if (superAdminRole.length > 0) {
      const superAdminRoleId = superAdminRole[0].id;
      
      // Get all page IDs
      const [allPages] = await pool.execute('SELECT id, page_path FROM page_permissions WHERE is_active = 1');
      
      for (const page of allPages) {
        await pool.execute(`
          INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
          VALUES (?, ?, 1, 1, 1, 1, 1)
          ON DUPLICATE KEY UPDATE
            can_view = 1, can_add = 1, can_update = 1, can_delete = 1, updated_at = CURRENT_TIMESTAMP
        `, [superAdminRoleId, page.id]);
      }
      
      console.log(`✅ Updated super admin permissions for ${allPages.length} pages`);
    }

    // Update admin role permissions (most pages except super admin specific)
    const [adminRole] = await pool.execute("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");
    if (adminRole.length > 0) {
      const adminRoleId = adminRole[0].id;
      
      const [adminPages] = await pool.execute(`
        SELECT id, page_path FROM page_permissions 
        WHERE is_active = 1 AND page_path NOT IN ('/roles')
      `);
      
      for (const page of adminPages) {
        await pool.execute(`
          INSERT INTO role_page_permissions (role_id, page_id, can_view, can_add, can_update, can_delete, created_by)
          VALUES (?, ?, 1, 1, 1, 1, 1)
          ON DUPLICATE KEY UPDATE
            can_view = 1, can_add = 1, can_update = 1, can_delete = 1, updated_at = CURRENT_TIMESTAMP
        `, [adminRoleId, page.id]);
      }
      
      console.log(`✅ Updated admin permissions for ${adminPages.length} pages`);
    }

    console.log('\n🎉 Sidebar pages setup completed successfully!');

  } catch (error) {
    console.error('❌ Error adding sidebar pages:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the script
if (require.main === module) {
  addSidebarPages();
}

module.exports = { addSidebarPages };
