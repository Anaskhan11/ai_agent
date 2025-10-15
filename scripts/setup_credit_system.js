const pool = require('../config/DBConnection');
const fs = require('fs');
const path = require('path');

async function setupCreditSystem() {
  let connection;
  try {
    console.log('🚀 Setting up Credit System Database...');
    connection = await pool.getConnection();

    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'credit_system_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Split the SQL into individual statements
    const statements = schemaSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📋 Executing ${statements.length} SQL statements...`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
          await connection.execute(statement);
        } catch (error) {
          // Log error but continue (some statements might fail if tables already exist)
          console.log(`⚠️  Statement ${i + 1} warning:`, error.message);
        }
      }
    }

    // Verify tables were created
    console.log('\n🔍 Verifying credit system tables...');
    const tables = [
      'credit_packages',
      'user_credits', 
      'credit_transactions',
      'usage_tracking',
      'credit_pricing',
      'stripe_payments',
      'credit_alerts'
    ];

    for (const table of tables) {
      try {
        const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`✅ Table '${table}' exists`);
          
          // Show table structure
          const [structure] = await connection.execute(`DESCRIBE ${table}`);
          console.log(`   📊 Columns: ${structure.length}`);
        } else {
          console.log(`❌ Table '${table}' not found`);
        }
      } catch (error) {
        console.log(`❌ Error checking table '${table}':`, error.message);
      }
    }

    // Check if default data was inserted
    console.log('\n🔍 Verifying default data...');
    
    try {
      const [packages] = await connection.execute('SELECT COUNT(*) as count FROM credit_packages');
      console.log(`✅ Credit packages: ${packages[0].count} records`);
      
      const [pricing] = await connection.execute('SELECT COUNT(*) as count FROM credit_pricing');
      console.log(`✅ Credit pricing: ${pricing[0].count} records`);
    } catch (error) {
      console.log('⚠️  Error checking default data:', error.message);
    }

    // Add credit columns to users table if they don't exist
    console.log('\n🔧 Updating users table...');
    try {
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255) NULL,
        ADD COLUMN IF NOT EXISTS credit_alerts_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS low_credit_threshold DECIMAL(15,2) DEFAULT 10.00
      `);
      console.log('✅ Users table updated with credit-related columns');
    } catch (error) {
      console.log('⚠️  Users table update warning:', error.message);
    }

    // Initialize credit balances for existing users
    console.log('\n💰 Initializing credit balances for existing users...');
    try {
      await connection.execute(`
        INSERT INTO user_credits (user_id, total_credits, used_credits)
        SELECT id, 0.00, 0.00 FROM users 
        WHERE id NOT IN (SELECT user_id FROM user_credits)
      `);
      console.log('✅ Credit balances initialized for existing users');
    } catch (error) {
      console.log('⚠️  Credit initialization warning:', error.message);
    }

    console.log('\n🎉 Credit System setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Configure Stripe API keys in config.env');
    console.log('2. Set up Stripe webhooks');
    console.log('3. Test credit purchase flow');
    console.log('4. Implement credit middleware in your routes');

  } catch (error) {
    console.error('❌ Error setting up credit system:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupCreditSystem()
    .then(() => {
      console.log('✅ Setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupCreditSystem };
