const mysql = require('mysql2/promise');

async function addFreeTrialPackage() {
  let connection;
  
  try {
    console.log('🔗 Connecting to database...');
    
    // Create connection with explicit credentials
    connection = await mysql.createConnection({
      host: '37.27.187.4',
      user: 'root',
      password: 'l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX',
      database: 'ai_agent',
      port: 3306
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

    // Check if free trial package already exists
    const [existing] = await connection.execute(
      'SELECT package_id FROM credit_packages WHERE package_id = ?',
      ['free_trial']
    );

    if (existing.length > 0) {
      console.log('⚠️ Free trial package already exists, updating...');
      
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
      console.log('➕ Adding new free trial package...');
      
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

    // Show all packages after update
    const [finalPackages] = await connection.execute('SELECT package_id, name, credits_amount, price_cents FROM credit_packages');
    console.log('📦 Final packages list:', finalPackages);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
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
