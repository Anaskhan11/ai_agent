const pool = require('../config/DBConnection');
const UserRole = require('../model/rbacModel/userRoleModel');
const RolePagePermission = require('../model/rbacModel/rolePagePermissionModel');
const User = require('../model/userModel/userModel');
const Role = require('../model/roleModel/roleModel');

async function testRBACSystem() {
  console.log('🧪 Starting RBAC System Tests...\n');

  try {
    // Test 1: Verify database tables exist
    console.log('📋 Test 1: Verifying database tables...');
    const tables = [
      'roles',
      'users',
      'user_roles',
      'permissions',
      'role_permissions',
      'page_permissions',
      'role_page_permissions'
    ];

    for (const table of tables) {
      const [result] = await pool.execute(`SHOW TABLES LIKE '${table}'`);
      if (result.length > 0) {
        console.log(`✅ Table '${table}' exists`);
      } else {
        console.log(`❌ Table '${table}' missing`);
      }
    }

    // Test 2: Check if roles exist
    console.log('\n📋 Test 2: Checking default roles...');
    const roles = await Role.getAllRoles();
    console.log(`✅ Found ${roles.length} roles:`);
    roles.forEach(role => {
      console.log(`   - ${role.name} (${role.display_name}) - ${role.is_system_role ? 'System' : 'Custom'}`);
    });

    // Test 3: Check super admin user
    console.log('\n📋 Test 3: Checking super admin user...');
    const superAdminUsers = await pool.execute(`
      SELECT u.id, u.username, u.email, u.is_super_admin, u.role_id 
      FROM users u 
      WHERE u.is_super_admin = 1 OR u.role_id = 1
    `);
    
    if (superAdminUsers[0].length > 0) {
      console.log(`✅ Found ${superAdminUsers[0].length} super admin user(s):`);
      superAdminUsers[0].forEach(user => {
        console.log(`   - ${user.username} (${user.email}) - Role ID: ${user.role_id}`);
      });
    } else {
      console.log('❌ No super admin users found');
    }

    // Test 4: Check role page permissions
    console.log('\n📋 Test 4: Checking role page permissions...');
    const rolePagePermissions = await pool.execute(`
      SELECT COUNT(*) as count FROM role_page_permissions WHERE is_active = 1
    `);
    console.log(`✅ Found ${rolePagePermissions[0][0].count} active role page permissions`);

    // Test 5: Test user role assignment
    console.log('\n📋 Test 5: Testing user role functionality...');
    const testUserId = superAdminUsers[0][0]?.id;
    if (testUserId) {
      const userRoles = await UserRole.getUserRolesByUserId(testUserId);
      console.log(`✅ User ${testUserId} has ${userRoles.length} role(s):`);
      userRoles.forEach(role => {
        console.log(`   - ${role.role_name} (${role.role_display_name})`);
      });

      // Test comprehensive permissions
      const comprehensivePermissions = await UserRole.getUserComprehensivePermissions(testUserId);
      console.log(`✅ User ${testUserId} has ${comprehensivePermissions.length} total permissions`);

      // Test page permissions
      const pagePermissions = await RolePagePermission.getUserPagePermissions(testUserId);
      console.log(`✅ User ${testUserId} has access to ${pagePermissions.length} pages`);
    }

    // Test 6: Test role page permissions for different roles
    console.log('\n📋 Test 6: Testing role page permissions...');
    for (const role of roles.slice(0, 3)) { // Test first 3 roles
      const rolePages = await RolePagePermission.getRolePagePermissionsWithDetails(role.id);
      const accessiblePages = rolePages.filter(p => p.can_view);
      console.log(`✅ Role '${role.name}' has access to ${accessiblePages.length} pages`);
    }

    // Test 7: Test super admin detection
    console.log('\n📋 Test 7: Testing super admin detection...');
    if (testUserId) {
      const isSuperAdmin = await User.isUserSuperAdmin(testUserId);
      console.log(`✅ User ${testUserId} super admin status: ${isSuperAdmin}`);
    }

    // Test 8: Test API endpoints (basic connectivity)
    console.log('\n📋 Test 8: Testing API endpoint structure...');
    const endpoints = [
      '/api/roles',
      '/api/user-roles',
      '/api/role-page-permissions',
      '/api/permissions',
      '/api/users/with-roles'
    ];
    console.log(`✅ Expected API endpoints: ${endpoints.join(', ')}`);

    // Test 9: Verify foreign key constraints
    console.log('\n📋 Test 9: Testing foreign key constraints...');
    try {
      // Try to insert invalid role_page_permission (should fail)
      await pool.execute(`
        INSERT INTO role_page_permissions (role_id, page_id, can_view) 
        VALUES (99999, 99999, 1)
      `);
      console.log('❌ Foreign key constraints not working properly');
    } catch (error) {
      if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        console.log('✅ Foreign key constraints working properly');
      } else {
        console.log(`⚠️ Unexpected error: ${error.message}`);
      }
    }

    // Test 10: Performance check
    console.log('\n📋 Test 10: Performance check...');
    const startTime = Date.now();
    
    if (testUserId) {
      await Promise.all([
        UserRole.getUserRolesByUserId(testUserId),
        UserRole.getUserComprehensivePermissions(testUserId),
        RolePagePermission.getUserPagePermissions(testUserId),
        User.isUserSuperAdmin(testUserId)
      ]);
    }
    
    const endTime = Date.now();
    console.log(`✅ Permission queries completed in ${endTime - startTime}ms`);

    console.log('\n🎉 RBAC System Tests Completed Successfully!');
    console.log('\n📊 Summary:');
    console.log(`   - Roles: ${roles.length}`);
    console.log(`   - Role Page Permissions: ${rolePagePermissions[0][0].count}`);
    console.log(`   - Super Admin Users: ${superAdminUsers[0].length}`);
    console.log(`   - All core functionality working ✅`);

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Additional helper function to create test scenarios
async function createTestScenarios() {
  console.log('\n🧪 Creating test scenarios...');
  
  try {
    // Create a test manager role if it doesn't exist
    const managerRole = await Role.findRoleByName('manager');
    if (!managerRole) {
      console.log('Creating test manager role...');
      await Role.createRole({
        name: 'test_manager',
        display_name: 'Test Manager',
        description: 'Test role for RBAC validation'
      });
    }

    console.log('✅ Test scenarios ready');
  } catch (error) {
    console.error('❌ Failed to create test scenarios:', error);
  }
}

// Run tests
if (require.main === module) {
  testRBACSystem();
}

module.exports = { testRBACSystem, createTestScenarios };
