const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function createListsTable() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await pool.getConnection();
    
    // Create lists table
    console.log('Creating lists table...');
    const createListsTableSQL = `
      CREATE TABLE IF NOT EXISTS lists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        list_name VARCHAR(255) NOT NULL,
        type ENUM('Marketing', 'Sales', 'Event', 'Customer', 'General') DEFAULT 'General',
        contacts_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        user_id INT NOT NULL,
        list_description TEXT,
        INDEX idx_user_id (user_id),
        INDEX idx_list_name (list_name),
        INDEX idx_created_at (created_at)
      )
    `;
    
    await connection.query(createListsTableSQL);
    console.log('✓ Lists table created successfully');
    
    // Add new columns to contacts table if they don't exist
    console.log('Adding new columns to contacts table...');
    
    try {
      await connection.query('ALTER TABLE contacts ADD COLUMN first_name VARCHAR(255)');
      console.log('✓ Added first_name column to contacts');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠ first_name column already exists');
      } else {
        console.error('Error adding first_name column:', error.message);
      }
    }
    
    try {
      await connection.query('ALTER TABLE contacts ADD COLUMN list_id INT');
      console.log('✓ Added list_id column to contacts');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠ list_id column already exists');
      } else {
        console.error('Error adding list_id column:', error.message);
      }
    }
    
    try {
      await connection.query('ALTER TABLE contacts ADD COLUMN phone_number VARCHAR(20)');
      console.log('✓ Added phone_number column to contacts');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠ phone_number column already exists');
      } else {
        console.error('Error adding phone_number column:', error.message);
      }
    }
    
    // Add indexes
    try {
      await connection.query('ALTER TABLE contacts ADD INDEX idx_list_id (list_id)');
      console.log('✓ Added index on list_id');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠ Index on list_id already exists');
      } else {
        console.error('Error adding index on list_id:', error.message);
      }
    }
    
    try {
      await connection.query('ALTER TABLE contacts ADD INDEX idx_user_id (user_id)');
      console.log('✓ Added index on user_id');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠ Index on user_id already exists');
      } else {
        console.error('Error adding index on user_id:', error.message);
      }
    }
    
    try {
      await connection.query('ALTER TABLE contacts ADD INDEX idx_email (email)');
      console.log('✓ Added index on email');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠ Index on email already exists');
      } else {
        console.error('Error adding index on email:', error.message);
      }
    }
    
    // Create triggers for automatic contact count updates
    console.log('Creating triggers...');
    
    try {
      await connection.query('DROP TRIGGER IF EXISTS update_list_count_insert');
      await connection.query(`
        CREATE TRIGGER update_list_count_insert
        AFTER INSERT ON contacts
        FOR EACH ROW
        UPDATE lists 
        SET contacts_count = (
          SELECT COUNT(*) 
          FROM contacts 
          WHERE list_id = NEW.list_id
        )
        WHERE id = NEW.list_id
      `);
      console.log('✓ Created insert trigger');
    } catch (error) {
      console.error('Error creating insert trigger:', error.message);
    }
    
    try {
      await connection.query('DROP TRIGGER IF EXISTS update_list_count_delete');
      await connection.query(`
        CREATE TRIGGER update_list_count_delete
        AFTER DELETE ON contacts
        FOR EACH ROW
        UPDATE lists 
        SET contacts_count = (
          SELECT COUNT(*) 
          FROM contacts 
          WHERE list_id = OLD.list_id
        )
        WHERE id = OLD.list_id
      `);
      console.log('✓ Created delete trigger');
    } catch (error) {
      console.error('Error creating delete trigger:', error.message);
    }
    
    // Verify tables exist
    console.log('\nVerifying table structure...');
    const [tables] = await connection.query("SHOW TABLES");
    console.log('Available tables:', tables.map(t => Object.values(t)[0]));
    
    // Show lists table structure
    try {
      const [listsDesc] = await connection.query("DESCRIBE lists");
      console.log('\n✓ Lists table structure:');
      listsDesc.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
    } catch (error) {
      console.error('❌ Lists table not found:', error.message);
    }
    
    // Show contacts table structure
    const [contactsDesc] = await connection.query("DESCRIBE contacts");
    console.log('\n✓ Contacts table structure:');
    contactsDesc.forEach(col => {
      console.log(`  - ${col.Field}: ${col.Type}`);
    });
    
    console.log('\n✅ Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Error setting up database:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Run the setup
createListsTable();
