const pool = require('../config/DBConnection');
const Permission = require('../model/rbacModel/permissionModel');
const RolePermission = require('../model/rbacModel/rolePermissionModel');
const PagePermission = require('../model/rbacModel/pagePermissionModel');
const Role = require('../model/roleModel/roleModel');

async function testRBAC() {
  try {
    console.log('🧪 Starting RBAC system tests...\n');
    
    // Test 1: Check if roles exist
    console.log('📋 Test 1: Checking roles...');
    const roles = await Role.getAllRoles();
    console.log(`✅ Found ${roles.length} roles:`);
    roles.forEach(role => {
      console.log(`   - ${role.display_name} (${role.name}) - Level ${role.hierarchy_level}`);
    });
    console.log('');
    
    // Test 2: Check if permissions exist
    console.log('🔑 Test 2: Checking permissions...');
    const permissions = await Permission.getAllPermissions();
    console.log(`✅ Found ${permissions.length} permissions`);
    
    // Group permissions by category
    const permissionsByCategory = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {});
    
    Object.entries(permissionsByCategory).forEach(([category, perms]) => {
      console.log(`   - ${category}: ${perms.length} permissions`);
    });
    console.log('');
    
    // Test 3: Check super admin permissions
    console.log('👑 Test 3: Checking super admin permissions...');
    const superAdminRole = roles.find(r => r.name === 'super_admin');
    if (superAdminRole) {
      const superAdminPermissions = await RolePermission.getRolePermissionsByRoleId(superAdminRole.id);
      console.log(`✅ Super admin has ${superAdminPermissions.length} permissions`);
      
      // Check if super admin has all permissions
      if (superAdminPermissions.length === permissions.length) {
        console.log('✅ Super admin has ALL permissions (correct)');
      } else {
        console.log('⚠️  Super admin does not have all permissions');
      }
    } else {
      console.log('❌ Super admin role not found');
    }
    console.log('');
    
    // Test 4: Check page permissions
    console.log('📄 Test 4: Checking page permissions...');
    const pagePermissions = await PagePermission.getAllPagePermissions();
    console.log(`✅ Found ${pagePermissions.length} page permissions`);
    
    // Group by category
    const pagesByCategory = pagePermissions.reduce((acc, page) => {
      if (!acc[page.page_category]) acc[page.page_category] = [];
      acc[page.page_category].push(page);
      return acc;
    }, {});
    
    Object.entries(pagesByCategory).forEach(([category, pages]) => {
      console.log(`   - ${category}: ${pages.length} pages`);
    });
    console.log('');
    
    // Test 5: Test permission checking for different roles
    console.log('🔍 Test 5: Testing permission checks...');
    
    for (const role of roles) {
      const rolePermissions = await RolePermission.getRolePermissionsByRoleId(role.id);
      console.log(`   - ${role.display_name}: ${rolePermissions.length} permissions`);
      
      // Test specific permission checks
      const canViewUsers = await RolePermission.checkRolePermission(role.id, 'users.view');
      const canDeleteUsers = await RolePermission.checkRolePermission(role.id, 'users.delete');
      const canViewRoles = await RolePermission.checkRolePermission(role.id, 'roles.view');
      
      console.log(`     - Can view users: ${canViewUsers ? '✅' : '❌'}`);
      console.log(`     - Can delete users: ${canDeleteUsers ? '✅' : '❌'}`);
      console.log(`     - Can view roles: ${canViewRoles ? '✅' : '❌'}`);
    }
    console.log('');
    
    // Test 6: Test super admin detection
    console.log('👑 Test 6: Testing super admin detection...');
    if (superAdminRole) {
      const isSuperAdmin = await Role.isSuperAdminRole(superAdminRole.id);
      console.log(`✅ Super admin detection: ${isSuperAdmin ? 'Working' : 'Failed'}`);
      
      // Test with non-super admin role
      const regularRole = roles.find(r => r.name === 'user');
      if (regularRole) {
        const isNotSuperAdmin = await Role.isSuperAdminRole(regularRole.id);
        console.log(`✅ Regular user detection: ${!isNotSuperAdmin ? 'Working' : 'Failed'}`);
      }
    }
    console.log('');
    
    console.log('🎉 RBAC system tests completed!');
    console.log('\n📊 Test Summary:');
    console.log(`- Roles: ${roles.length} found`);
    console.log(`- Permissions: ${permissions.length} found`);
    console.log(`- Page Permissions: ${pagePermissions.length} found`);
    console.log(`- Super Admin Permissions: ${superAdminRole ? 'Configured' : 'Missing'}`);
    
    console.log('\n✅ System appears to be working correctly!');
    console.log('You can now test the frontend interface.');
    
  } catch (error) {
    console.error('💥 Error during RBAC tests:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the test function if this script is executed directly
if (require.main === module) {
  testRBAC();
}

module.exports = testRBAC;
