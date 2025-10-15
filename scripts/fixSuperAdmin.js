const pool = require('../config/DBConnection');

async function fixSuperAdmin() {
  try {
    console.log('🔧 Fixing Super Admin setup...\n');
    
    // 1. Ensure super_admin role exists with ID 1
    console.log('1. Checking super_admin role...');
    const [roleCheck] = await pool.execute(
      'SELECT * FROM roles WHERE id = 1'
    );
    
    if (roleCheck.length === 0) {
      console.log('   Creating super_admin role with ID 1...');
      await pool.execute(
        'INSERT INTO roles (id, name, display_name, description, is_system_role) VALUES (1, "super_admin", "Super Administrator", "Full system access", 1)'
      );
    } else {
      console.log('   Updating existing role to super_admin...');
      await pool.execute(
        'UPDATE roles SET name = "super_admin", display_name = "Super Administrator", description = "Full system access", is_system_role = 1 WHERE id = 1'
      );
    }
    
    // 2. Update user to have role_id = 1
    console.log('2. Updating user role...');
    const [userUpdate] = await pool.execute(
      'UPDATE users SET role_id = 1 WHERE email = "anas@sentrixmedia.com"'
    );
    
    if (userUpdate.affectedRows > 0) {
      console.log('   ✅ User role updated successfully');
    } else {
      console.log('   ⚠️  User not found or already has correct role');
    }
    
    // 3. Verify the setup
    console.log('3. Verifying setup...');
    const [userCheck] = await pool.execute(
      'SELECT u.id, u.email, u.role_id, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.email = "anas@sentrixmedia.com"'
    );
    
    if (userCheck.length > 0) {
      const user = userCheck[0];
      console.log('   User Details:');
      console.log(`   - Email: ${user.email}`);
      console.log(`   - Role ID: ${user.role_id}`);
      console.log(`   - Role Name: ${user.role_name}`);
      
      if (user.role_id === 1 && user.role_name === 'super_admin') {
        console.log('   ✅ Super admin setup is correct!');
      } else {
        console.log('   ❌ Setup still has issues');
      }
    }
    
    // 4. Check role permissions
    console.log('4. Checking role permissions...');
    const [permissionCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM role_permissions WHERE role_id = 1 AND is_active = 1'
    );
    
    console.log(`   Super admin has ${permissionCount[0].count} permissions`);
    
    if (permissionCount[0].count === 0) {
      console.log('   ⚠️  Super admin has no permissions! Run: npm run seed:rbac');
    }
    
    console.log('\n🎉 Super admin fix completed!');
    console.log('\nNext steps:');
    console.log('1. Restart your backend server');
    console.log('2. Refresh your browser');
    console.log('3. Login again');
    console.log('4. Check the debug panel');
    
  } catch (error) {
    console.error('💥 Error fixing super admin:', error);
  } finally {
    await pool.end();
  }
}

// Run the fix function if this script is executed directly
if (require.main === module) {
  fixSuperAdmin();
}

module.exports = fixSuperAdmin;
