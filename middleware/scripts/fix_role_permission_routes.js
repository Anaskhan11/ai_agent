const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function fixRolePermissionRoutes() {
  try {
    console.log('🔧 Fixing role permission routes in page_permissions table...\n');
    
    // First, let's check what currently exists
    const [currentRoutes] = await pool.execute(`
      SELECT * FROM page_permissions 
      WHERE page_path IN ('/role', '/roles', '/permissions', '/role-permissions')
      ORDER BY page_path
    `);
    
    console.log(`📊 Current role-related routes (${currentRoutes.length} found):`);
    currentRoutes.forEach((route, index) => {
      console.log(`${index + 1}. ${route.page_path} - ${route.page_name} (ID: ${route.id})`);
    });
    
    // Step 1: Update the existing /role route to /roles if it exists
    const [existingRole] = await pool.execute(`
      SELECT * FROM page_permissions WHERE page_path = '/role'
    `);
    
    if (existingRole.length > 0) {
      console.log('\n🔄 Updating existing /role route to /roles...');
      await pool.execute(`
        UPDATE page_permissions 
        SET page_path = '/roles', 
            page_name = 'Roles',
            page_category = 'admin',
            required_permission = 'roles.view',
            sort_order = 90,
            icon = 'Shield'
        WHERE page_path = '/role'
      `);
      console.log('✅ Updated /role to /roles');
    }
    
    // Step 2: Insert the missing routes (using INSERT IGNORE to avoid duplicates)
    console.log('\n📝 Adding missing role permission routes...');
    
    const routesToAdd = [
      {
        path: '/roles',
        name: 'Roles',
        category: 'admin',
        permission: 'roles.view',
        sort_order: 90,
        icon: 'Shield'
      },
      {
        path: '/permissions',
        name: 'Permissions',
        category: 'admin',
        permission: 'permissions.view',
        sort_order: 91,
        icon: 'Key'
      },
      {
        path: '/role-permissions',
        name: 'Role Permissions',
        category: 'admin',
        permission: 'role_permissions.view',
        sort_order: 92,
        icon: 'Users'
      }
    ];
    
    for (const route of routesToAdd) {
      try {
        await pool.execute(`
          INSERT IGNORE INTO page_permissions 
          (page_path, page_name, page_category, required_permission, is_public, sort_order, icon, is_active) 
          VALUES (?, ?, ?, ?, 0, ?, ?, 1)
        `, [route.path, route.name, route.category, route.permission, route.sort_order, route.icon]);
        
        console.log(`✅ Added/Updated: ${route.path} - ${route.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠️  Route ${route.path} already exists, skipping...`);
        } else {
          console.error(`❌ Error adding ${route.path}:`, error.message);
        }
      }
    }
    
    // Step 3: Verify the final result
    console.log('\n🔍 Verifying final result...');
    const [finalRoutes] = await pool.execute(`
      SELECT * FROM page_permissions 
      WHERE page_path IN ('/roles', '/permissions', '/role-permissions')
      ORDER BY sort_order
    `);
    
    console.log(`\n✅ Final role permission routes (${finalRoutes.length} total):`);
    finalRoutes.forEach((route, index) => {
      console.log(`${index + 1}. ${route.page_path} - ${route.page_name}`);
      console.log(`   Category: ${route.page_category}`);
      console.log(`   Permission: ${route.required_permission}`);
      console.log(`   Sort Order: ${route.sort_order}`);
      console.log(`   Icon: ${route.icon}`);
      console.log(`   Active: ${route.is_active ? 'Yes' : 'No'}`);
      console.log('   ---');
    });
    
    if (finalRoutes.length === 3) {
      console.log('\n🎉 SUCCESS! All role permission routes are now properly configured.');
    } else {
      console.log('\n⚠️  Warning: Expected 3 routes but found', finalRoutes.length);
    }
    
  } catch (error) {
    console.error('❌ Error fixing role permission routes:', error);
  } finally {
    await pool.end();
    console.log('\n🔚 Database connection closed');
  }
}

// Run the fix
fixRolePermissionRoutes();
