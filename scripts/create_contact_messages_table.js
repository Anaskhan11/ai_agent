const db = require('../config/DBConnection');

async function createContactMessagesTable() {
  try {
    console.log('🚀 Creating contact_messages table...');

    // Create contact_messages table
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS contact_messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        contact_id VARCHAR(255) NOT NULL,
        user_id INT UNSIGNED NOT NULL,
        content TEXT NOT NULL,
        sender ENUM('user', 'contact') NOT NULL,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        status ENUM('sending', 'sent', 'delivered', 'failed', 'read') NOT NULL DEFAULT 'sent',
        message_id VARCHAR(255) NULL,
        twilio_sid VARCHAR(255) NULL,
        phone_number VARCHAR(50) NULL,
        from_phone_number VARCHAR(50) NULL,
        metadata JSON NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        
        INDEX idx_contact_id (contact_id),
        INDEX idx_user_id (user_id),
        INDEX idx_timestamp (timestamp),
        INDEX idx_status (status),
        INDEX idx_sender (sender),
        INDEX idx_twilio_sid (twilio_sid),
        
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    await db.execute(createTableQuery);
    console.log('✅ contact_messages table created successfully');

    // Add additional indexes for better performance
    try {
      await db.execute(`
        CREATE INDEX idx_contact_user_timestamp ON contact_messages (contact_id, user_id, timestamp)
      `);
      console.log('✅ Added idx_contact_user_timestamp index');
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index idx_contact_user_timestamp might already exist');
      }
    }

    try {
      await db.execute(`
        CREATE INDEX idx_user_timestamp ON contact_messages (user_id, timestamp DESC)
      `);
      console.log('✅ Added idx_user_timestamp index');
    } catch (error) {
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.log('⚠️ Index idx_user_timestamp might already exist');
      }
    }

    console.log('🎉 Contact messages table setup completed successfully!');

  } catch (error) {
    console.error('❌ Error creating contact_messages table:', error);
    throw error;
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  createContactMessagesTable()
    .then(() => {
      console.log('✅ Migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration failed:', error);
      process.exit(1);
    });
}

module.exports = createContactMessagesTable;
