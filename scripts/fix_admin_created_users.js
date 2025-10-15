const pool = require('../config/DBConnection');

/**
 * Script to fix existing admin-created users who should not require email verification
 * This script identifies users who were likely created by admins and marks them as email verified
 */

async function fixAdminCreatedUsers() {
  console.log('🔧 Starting fix for admin-created users...');
  
  const connection = await pool.getConnection();
  
  try {
    // Find users who are not email verified but might be admin-created
    // We'll identify them by checking if they have no OTP records (indicating they weren't registered via /api/users/register)
    const [unverifiedUsers] = await connection.execute(`
      SELECT u.id, u.email, u.first_name, u.last_name, u.created_at
      FROM users u
      LEFT JOIN email_verification_otps otp ON u.email = otp.email
      WHERE u.email_verified = FALSE 
      AND otp.email IS NULL
      AND u.is_active = TRUE
      ORDER BY u.created_at DESC
    `);

    console.log(`📊 Found ${unverifiedUsers.length} users without email verification and no OTP records`);

    if (unverifiedUsers.length === 0) {
      console.log('✅ No users need to be fixed');
      return;
    }

    // Display users that will be updated
    console.log('\n📋 Users that will be marked as email verified:');
    unverifiedUsers.forEach(user => {
      console.log(`  - ID: ${user.id}, Email: ${user.email}, Name: ${user.first_name} ${user.last_name}, Created: ${user.created_at}`);
    });

    // Ask for confirmation (in a real scenario, you might want to add a confirmation prompt)
    console.log('\n⚠️  This will mark these users as email verified. Make sure these are admin-created users!');
    
    // Update users to be email verified
    const userIds = unverifiedUsers.map(user => user.id);
    
    if (userIds.length > 0) {
      const placeholders = userIds.map(() => '?').join(',');
      const [result] = await connection.execute(`
        UPDATE users 
        SET email_verified = TRUE, 
            email_verified_at = NOW(),
            updated_at = NOW()
        WHERE id IN (${placeholders})
      `, userIds);

      console.log(`✅ Successfully updated ${result.affectedRows} users`);
      
      // Log the changes
      console.log('\n📝 Updated users:');
      for (const user of unverifiedUsers) {
        console.log(`  ✓ User ${user.id} (${user.email}) - marked as email verified`);
      }
    }

  } catch (error) {
    console.error('❌ Error fixing admin-created users:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run the script if called directly
if (require.main === module) {
  fixAdminCreatedUsers()
    .then(() => {
      console.log('\n🎉 Fix completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixAdminCreatedUsers };
