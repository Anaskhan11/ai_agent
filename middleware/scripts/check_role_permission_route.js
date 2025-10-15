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

async function checkRolePermissionRoute() {
  try {
    console.log('🔍 Checking for role permission route in page_permissions table...\n');
    
    // Check for any role-related routes
    const [roleRoutes] = await pool.execute(`
      SELECT * FROM page_permissions 
      WHERE page_path LIKE '%role%' 
         OR page_name LIKE '%role%' 
         OR page_name LIKE '%Role%'
         OR page_path LIKE '%permission%'
         OR page_name LIKE '%permission%'
         OR page_name LIKE '%Permission%'
      ORDER BY page_path
    `);
    
    console.log(`📊 Found ${roleRoutes.length} role/permission related routes:`);
    
    if (roleRoutes.length > 0) {
      console.log('\n📋 Current role/permission routes:');
      roleRoutes.forEach((route, index) => {
        console.log(`${index + 1}. Path: ${route.page_path}`);
        console.log(`   Name: ${route.page_name}`);
        console.log(`   Category: ${route.page_category}`);
        console.log(`   Required Permission: ${route.required_permission}`);
        console.log(`   Sort Order: ${route.sort_order}`);
        console.log(`   Icon: ${route.icon}`);
        console.log(`   Active: ${route.is_active ? 'Yes' : 'No'}`);
        console.log('   ---');
      });
    } else {
      console.log('\n❌ No role/permission routes found!');
    }
    
    // Check specifically for the expected role permission route
    const [specificRoute] = await pool.execute(`
      SELECT * FROM page_permissions 
      WHERE page_path = '/roles' OR page_path = '/role-permissions'
      ORDER BY page_path
    `);
    
    console.log(`\n🎯 Checking for specific role permission routes (/roles, /role-permissions):`);
    console.log(`Found ${specificRoute.length} specific routes`);
    
    if (specificRoute.length > 0) {
      specificRoute.forEach((route, index) => {
        console.log(`\n${index + 1}. ✅ Found: ${route.page_path}`);
        console.log(`   ID: ${route.id}`);
        console.log(`   Name: ${route.page_name}`);
        console.log(`   Category: ${route.page_category}`);
        console.log(`   Required Permission: ${route.required_permission}`);
        console.log(`   Sort Order: ${route.sort_order}`);
        console.log(`   Icon: ${route.icon}`);
        console.log(`   Active: ${route.is_active ? 'Yes' : 'No'}`);
      });
    } else {
      console.log('❌ No specific role permission routes found!');
      console.log('\n💡 Expected routes that should exist:');
      console.log('   - /roles (Role Management page)');
      console.log('   - /role-permissions (Role Permission Management page)');
    }
    
    // Show all system/management category pages for reference
    const [systemPages] = await pool.execute(`
      SELECT page_path, page_name, page_category, sort_order, is_active 
      FROM page_permissions 
      WHERE page_category IN ('system', 'management') 
      ORDER BY page_category, sort_order, page_name
    `);
    
    console.log(`\n📂 All system/management pages for reference (${systemPages.length} total):`);
    systemPages.forEach((page, index) => {
      const status = page.is_active ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${page.page_path} - ${page.page_name} (${page.page_category})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking role permission route:', error);
  } finally {
    await pool.end();
    console.log('\n🔚 Database connection closed');
  }
}

// Run the check
checkRolePermissionRoute();
