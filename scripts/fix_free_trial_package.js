const mysql = require('mysql2/promise');
require('dotenv').config({ path: '../config/config.env' });

async function addFreeTrialPackage() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    console.log('Host:', process.env.DB_HOST);
    console.log('User:', process.env.DB_USER);
    console.log('Database:', process.env.DB_NAME);

    // Create connection
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT || 3306
    });

    console.log('✅ Connected to database');

    // First, let's check what tables exist
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 Available tables:', tables.map(t => Object.values(t)[0]));

    // Check if credit_packages table exists
    const hasPackagesTable = tables.some(t => Object.values(t)[0] === 'credit_packages');

    if (!hasPackagesTable) {
      console.log('❌ credit_packages table does not exist!');
      process.exit(1);
    }

    // Check current packages
    const [allPackages] = await connection.execute('SELECT package_id, name, credits_amount, price_cents FROM credit_packages');
    console.log('📦 Current packages:', allPackages);

    // First, check if the package already exists
    const [existing] = await connection.execute(
      'SELECT package_id FROM credit_packages WHERE package_id = ?',
      ['free_trial']
    );

    if (existing.length > 0) {
      console.log('⚠️  Free trial package already exists, updating it...');
      
      // Update existing package
      await connection.execute(`
        UPDATE credit_packages 
        SET 
          name = ?,
          description = ?,
          credits_amount = ?,
          price_cents = ?,
          currency = ?,
          is_active = ?,
          is_popular = ?,
          bonus_credits = ?,
          valid_for_days = ?,
          metadata = ?
        WHERE package_id = ?
      `, [
        'Free Trial - $10 Credits',
        'Get started with $10 worth of free credits! One-time offer for new users. Card required for verification.',
        1000,
        0,
        'USD',
        true,
        false,
        0,
        30,
        JSON.stringify({
          "is_free_trial": true,
          "original_value_cents": 1000,
          "promotion_type": "new_user_trial",
          "requires_card_verification": true
        }),
        'free_trial'
      ]);
      
      console.log('✅ Updated existing free trial package');
    } else {
      // Insert new package
      await connection.execute(`
        INSERT INTO credit_packages (
          package_id, name, description, credits_amount, price_cents, 
          currency, is_active, is_popular, bonus_credits, valid_for_days, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        'free_trial',
        'Free Trial - $10 Credits',
        'Get started with $10 worth of free credits! One-time offer for new users. Card required for verification.',
        1000,
        0,
        'USD',
        true,
        false,
        0,
        30,
        JSON.stringify({
          "is_free_trial": true,
          "original_value_cents": 1000,
          "promotion_type": "new_user_trial",
          "requires_card_verification": true
        })
      ]);
      
      console.log('✅ Added new free trial package');
    }

    // Verify the package was added/updated
    const [result] = await connection.execute(
      'SELECT package_id, name, credits_amount, price_cents FROM credit_packages WHERE package_id = ?',
      ['free_trial']
    );

    if (result.length > 0) {
      console.log('✅ Free trial package verified:');
      console.log('   Package ID:', result[0].package_id);
      console.log('   Name:', result[0].name);
      console.log('   Credits:', result[0].credits_amount);
      console.log('   Price:', result[0].price_cents, 'cents');
    } else {
      console.log('❌ Failed to verify free trial package');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
addFreeTrialPackage();
