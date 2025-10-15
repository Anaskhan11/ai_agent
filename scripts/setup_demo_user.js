const pool = require('../config/DBConnection');

async function setupDemoUser() {
  console.log('🚀 Setting up demo user for credit system testing...');
  
  try {
    // Check if demo user exists in users table
    const [existingUsers] = await pool.execute('SELECT * FROM users WHERE id = 1');
    
    if (existingUsers.length === 0) {
      // Create demo user in users table
      await pool.execute(`
        INSERT INTO users (id, email, first_name, last_name, username, password, created_at, updated_at)
        VALUES (1, 'demo@example.com', 'Demo', 'User', 'demo', '$2a$10$dummy.hash.for.demo.user', NOW(), NOW())
        ON DUPLICATE KEY UPDATE email = VALUES(email)
      `);
      console.log('✅ Demo user created in users table');
    } else {
      console.log('✅ Demo user already exists in users table');
    }
    
    // Check if demo user has credit record
    const [existingCredits] = await pool.execute('SELECT * FROM user_credits WHERE user_id = 1');
    
    if (existingCredits.length === 0) {
      // Create credit record for demo user
      await pool.execute(`
        INSERT INTO user_credits (user_id, available_credits, total_credits_used, created_at, updated_at)
        VALUES (1, 1000, 0, NOW(), NOW())
      `);
      console.log('✅ Demo user credit record created with 1000 credits');
    } else {
      console.log('✅ Demo user credit record already exists');
      console.log(`   Available Credits: ${existingCredits[0].available_credits}`);
    }
    
    // Check credit packages and fix any missing price values
    const [packages] = await pool.execute('SELECT * FROM credit_packages WHERE is_active = 1');
    console.log(`✅ Active credit packages: ${packages.length}`);

    for (const pkg of packages) {
      if (!pkg.price_cents || pkg.price_cents === null || pkg.price_cents === 0) {
        // Calculate price based on credits (example: $0.01 per credit = 1 cent per credit)
        const calculatedPriceCents = pkg.credits_amount + (pkg.bonus_credits || 0);
        await pool.execute(
          'UPDATE credit_packages SET price_cents = ? WHERE id = ?',
          [calculatedPriceCents, pkg.id]
        );
        console.log(`   Fixed price for ${pkg.name}: $${(calculatedPriceCents / 100).toFixed(2)}`);
      } else {
        const totalCredits = pkg.credits_amount + (pkg.bonus_credits || 0);
        console.log(`   - ${pkg.name}: $${(pkg.price_cents / 100).toFixed(2)} (${totalCredits} credits)`);
      }
    }
    
    // Check if demo user has super admin role for testing admin endpoints
    const [roleAssignments] = await pool.execute(`
      SELECT ur.*, r.name as role_name 
      FROM user_roles ur 
      JOIN roles r ON ur.role_id = r.id 
      WHERE ur.user_id = 1
    `);
    
    if (roleAssignments.length === 0) {
      // Try to assign super admin role if it exists
      const [superAdminRole] = await pool.execute('SELECT * FROM roles WHERE name = "super_admin" LIMIT 1');
      if (superAdminRole.length > 0) {
        await pool.execute(`
          INSERT INTO user_roles (user_id, role_id, created_at, updated_at)
          VALUES (1, ?, NOW(), NOW())
          ON DUPLICATE KEY UPDATE updated_at = NOW()
        `, [superAdminRole[0].id]);
        console.log('✅ Demo user assigned super admin role');
      } else {
        console.log('⚠️  Super admin role not found, demo user will have limited permissions');
      }
    } else {
      console.log(`✅ Demo user has roles: ${roleAssignments.map(r => r.role_name).join(', ')}`);
    }
    
    console.log('\n🎉 Demo user setup complete!');
    console.log('   User ID: 1');
    console.log('   Email: demo@example.com');
    console.log('   Credits: 1000');
    console.log('   Ready for credit system testing');
    
  } catch (error) {
    console.error('❌ Error setting up demo user:', error.message);
    throw error;
  }
}

// Run the setup
setupDemoUser()
  .then(() => {
    console.log('\n✅ Demo user setup completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Demo user setup failed:', error);
    process.exit(1);
  });
