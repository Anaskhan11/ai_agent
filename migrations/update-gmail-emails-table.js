const pool = require('../config/DBConnection');

/**
 * Migration script to update gmail_emails table with new columns
 * This adds enhanced email data fields for better webhook functionality
 */
async function updateGmailEmailsTable() {
  console.log('🔧 Starting gmail_emails table migration...');
  
  const connection = await pool.getConnection();
  try {
    // Check if table exists
    const [tables] = await connection.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gmail_emails'`
    );

    if (tables.length === 0) {
      console.log('ℹ️  gmail_emails table does not exist, skipping migration');
      return;
    }

    console.log('📊 Checking existing columns...');
    const [columns] = await connection.execute('DESCRIBE gmail_emails');
    const existingColumns = columns.map(col => col.Field);
    console.log('   Existing columns:', existingColumns.join(', '));

    // Define new columns to add
    const newColumns = [
      {
        name: 'to_address',
        definition: 'TEXT',
        description: 'Email To field'
      },
      {
        name: 'cc_address', 
        definition: 'TEXT',
        description: 'Email CC field'
      },
      {
        name: 'bcc_address',
        definition: 'TEXT', 
        description: 'Email BCC field'
      },
      {
        name: 'body_text',
        definition: 'LONGTEXT',
        description: 'Email plain text body'
      },
      {
        name: 'body_html',
        definition: 'LONGTEXT',
        description: 'Email HTML body'
      },
      {
        name: 'attachments_count',
        definition: 'INT DEFAULT 0',
        description: 'Number of attachments'
      },
      {
        name: 'attachments_info',
        definition: 'JSON',
        description: 'Attachment metadata as JSON'
      }
    ];

    // Add missing columns
    let addedColumns = 0;
    for (const column of newColumns) {
      if (!existingColumns.includes(column.name)) {
        try {
          console.log(`➕ Adding column: ${column.name} (${column.description})`);
          await connection.execute(
            `ALTER TABLE gmail_emails ADD COLUMN ${column.name} ${column.definition}`
          );
          addedColumns++;
          console.log(`✅ Added column: ${column.name}`);
        } catch (error) {
          if (error.code === 'ER_DUP_FIELDNAME') {
            console.log(`ℹ️  Column ${column.name} already exists`);
          } else {
            console.error(`❌ Error adding column ${column.name}:`, error.message);
            throw error;
          }
        }
      } else {
        console.log(`✅ Column ${column.name} already exists`);
      }
    }

    // Add new indexes for better performance
    const newIndexes = [
      {
        name: 'idx_attachments_count',
        definition: 'INDEX idx_attachments_count (attachments_count)',
        description: 'Index on attachments count'
      }
    ];

    for (const index of newIndexes) {
      try {
        console.log(`➕ Adding index: ${index.name} (${index.description})`);
        await connection.execute(`ALTER TABLE gmail_emails ADD ${index.definition}`);
        console.log(`✅ Added index: ${index.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`ℹ️  Index ${index.name} already exists`);
        } else {
          console.error(`❌ Error adding index ${index.name}:`, error.message);
          // Don't throw error for index creation failures
        }
      }
    }

    // Update the updated_at column if it doesn't exist
    if (!existingColumns.includes('updated_at')) {
      try {
        console.log('➕ Adding updated_at column...');
        await connection.execute(
          `ALTER TABLE gmail_emails 
           ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`
        );
        console.log('✅ Added updated_at column');
      } catch (error) {
        if (error.code !== 'ER_DUP_FIELDNAME') {
          console.error('❌ Error adding updated_at column:', error.message);
        }
      }
    }

    console.log(`🎉 Gmail emails table migration completed successfully!`);
    console.log(`📊 Summary: ${addedColumns} new columns added`);
    
    // Show final table structure
    console.log('\n📋 Final table structure:');
    const [finalColumns] = await connection.execute('DESCRIBE gmail_emails');
    finalColumns.forEach(col => {
      console.log(`   ${col.Field}: ${col.Type} ${col.Null === 'YES' ? '(nullable)' : '(not null)'} ${col.Default ? `default: ${col.Default}` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error during gmail_emails table migration:', error);
    throw error;
  } finally {
    connection.release();
  }
}

// Run migration if called directly
if (require.main === module) {
  updateGmailEmailsTable()
    .then(() => {
      console.log('✅ Gmail emails table migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Gmail emails table migration failed:', error);
      process.exit(1);
    });
}

module.exports = { updateGmailEmailsTable };
