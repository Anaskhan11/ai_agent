const pool = require('../config/DBConnection');
require('dotenv').config();

async function setupGmailTables() {
  let connection;
  
  try {
    console.log('🔧 Setting up Gmail integration tables...');
    
    connection = await pool.getConnection();
    console.log('✅ Connected to database');

    // Create gmail_tokens table
    console.log('\n📋 Creating gmail_tokens table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS gmail_tokens (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_type VARCHAR(50) DEFAULT 'Bearer',
        expiry_date DATETIME,
        scope TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_gmail (user_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_expiry_date (expiry_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ gmail_tokens table created successfully');

    // Create gmail_emails table
    console.log('\n📋 Creating gmail_emails table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS gmail_emails (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        from_address TEXT,
        email VARCHAR(255),
        name VARCHAR(255),
        subject TEXT,
        date VARCHAR(255),
        snippet TEXT,
        processed BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_message (user_id, message_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_email (email),
        INDEX idx_processed (processed),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ gmail_emails table created successfully');

    // Create gmail_webhook_triggers table
    console.log('\n📋 Creating gmail_webhook_triggers table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS gmail_webhook_triggers (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id INT UNSIGNED NOT NULL,
        message_id VARCHAR(255) NOT NULL,
        webhook_id INT UNSIGNED NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_trigger (user_id, message_id, webhook_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_webhook_id (webhook_id),
        INDEX idx_message_id (message_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ gmail_webhook_triggers table created successfully');

    // Create webhook_failures table
    console.log('\n📋 Creating webhook_failures table...');
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS webhook_failures (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        webhook_id INT UNSIGNED NOT NULL,
        error_message TEXT,
        payload JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE,
        INDEX idx_webhook_id (webhook_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ webhook_failures table created successfully');

    // Verify tables were created
    console.log('\n🔍 Verifying Gmail tables...');
    
    const tables = ['gmail_tokens', 'gmail_emails', 'gmail_webhook_triggers', 'webhook_failures'];
    for (const table of tables) {
      const [rows] = await connection.execute(`SHOW TABLES LIKE '${table}'`);
      if (rows.length > 0) {
        console.log(`✅ ${table} table exists`);
        
        // Show table structure
        const [columns] = await connection.execute(`DESCRIBE ${table}`);
        console.log(`   Columns: ${columns.map(col => col.Field).join(', ')}`);
      } else {
        console.log(`❌ ${table} table not found`);
      }
    }

    console.log('\n🎉 Gmail integration tables setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up Gmail tables:', error);
    throw error;
  } finally {
    if (connection) {
      connection.release();
      console.log('🔌 Database connection released');
    }
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupGmailTables()
    .then(() => {
      console.log('✅ Gmail tables setup completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Gmail tables setup failed:', error);
      process.exit(1);
    });
}

module.exports = { setupGmailTables };
