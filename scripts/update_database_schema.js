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

async function updateDatabaseSchema() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await pool.getConnection();
    
    // Step 1: Drop existing triggers
    console.log('Dropping existing triggers...');
    try {
      await connection.query('DROP TRIGGER IF EXISTS update_list_count_insert');
      await connection.query('DROP TRIGGER IF EXISTS update_list_count_delete');
      await connection.query('DROP TRIGGER IF EXISTS update_list_count_update');
      console.log('✓ Dropped existing triggers');
    } catch (error) {
      console.error('Error dropping triggers:', error.message);
    }

    // Step 2: Drop existing tables to recreate with new structure
    console.log('Dropping existing tables...');
    try {
      await connection.query('DROP TABLE IF EXISTS contacts');
      await connection.query('DROP TABLE IF EXISTS lists');
      console.log('✓ Dropped existing tables');
    } catch (error) {
      console.error('Error dropping tables:', error.message);
    }

    // Step 3: Create new lists table with simplified structure
    console.log('Creating new lists table...');
    const createListsTableSQL = `
      CREATE TABLE lists (
        id INT AUTO_INCREMENT PRIMARY KEY,
        listName VARCHAR(255) NOT NULL,
        type ENUM('Marketing', 'Sales', 'Event', 'Customer', 'General') DEFAULT 'General',
        description TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        userId INT NOT NULL,
        INDEX idx_userId (userId),
        INDEX idx_listName (listName),
        INDEX idx_createdAt (createdAt)
      )
    `;
    
    await connection.query(createListsTableSQL);
    console.log('✓ Created new lists table');

    // Step 4: Create new contacts table with simplified structure
    console.log('Creating new contacts table...');
    const createContactsTableSQL = `
      CREATE TABLE contacts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        fullName VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phoneNumber VARCHAR(20) NOT NULL,
        listId INT NOT NULL,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_listId (listId),
        INDEX idx_email (email),
        INDEX idx_fullName (fullName),
        FOREIGN KEY (listId) REFERENCES lists(id) ON DELETE CASCADE
      )
    `;
    
    await connection.query(createContactsTableSQL);
    console.log('✓ Created new contacts table');

    // Step 5: Create triggers to automatically update contact counts
    console.log('Creating triggers for contact count management...');
    
    // Add contacts_count column to lists table
    await connection.query('ALTER TABLE lists ADD COLUMN contacts_count INT DEFAULT 0');
    console.log('✓ Added contacts_count column to lists table');

    // Create insert trigger
    try {
      await connection.query(`
        CREATE TRIGGER update_list_count_insert
        AFTER INSERT ON contacts
        FOR EACH ROW
        UPDATE lists 
        SET contacts_count = (
          SELECT COUNT(*) 
          FROM contacts 
          WHERE listId = NEW.listId
        )
        WHERE id = NEW.listId
      `);
      console.log('✓ Created insert trigger');
    } catch (error) {
      console.error('Error creating insert trigger:', error.message);
    }

    // Create delete trigger
    try {
      await connection.query(`
        CREATE TRIGGER update_list_count_delete
        AFTER DELETE ON contacts
        FOR EACH ROW
        UPDATE lists 
        SET contacts_count = (
          SELECT COUNT(*) 
          FROM contacts 
          WHERE listId = OLD.listId
        )
        WHERE id = OLD.listId
      `);
      console.log('✓ Created delete trigger');
    } catch (error) {
      console.error('Error creating delete trigger:', error.message);
    }

    // Create update trigger
    try {
      await connection.query(`
        CREATE TRIGGER update_list_count_update
        AFTER UPDATE ON contacts
        FOR EACH ROW
        BEGIN
          IF OLD.listId != NEW.listId THEN
            UPDATE lists 
            SET contacts_count = (
              SELECT COUNT(*) 
              FROM contacts 
              WHERE listId = OLD.listId
            )
            WHERE id = OLD.listId;
          END IF;
          
          UPDATE lists 
          SET contacts_count = (
            SELECT COUNT(*) 
            FROM contacts 
            WHERE listId = NEW.listId
          )
          WHERE id = NEW.listId;
        END
      `);
      console.log('✓ Created update trigger');
    } catch (error) {
      console.error('Error creating update trigger:', error.message);
    }

    // Step 6: Insert some sample data for testing
    console.log('Inserting sample data...');
    try {
      // Insert sample lists
      await connection.query(`
        INSERT INTO lists (listName, type, description, userId) VALUES
        ('Marketing Campaign 2024', 'Marketing', 'Email marketing campaign for product launch', 1),
        ('Sales Prospects', 'Sales', 'Potential customers for Q4 sales push', 1),
        ('Event Attendees', 'Event', 'Conference attendees list', 1)
      `);

      // Insert sample contacts
      await connection.query(`
        INSERT INTO contacts (fullName, email, phoneNumber, listId) VALUES
        ('John Doe', 'john.doe@example.com', '+1234567890', 1),
        ('Jane Smith', 'jane.smith@example.com', '+1234567891', 1),
        ('Bob Johnson', 'bob.johnson@example.com', '+1234567892', 2),
        ('Alice Brown', 'alice.brown@example.com', '+1234567893', 2),
        ('Charlie Wilson', 'charlie.wilson@example.com', '+1234567894', 3)
      `);
      
      console.log('✓ Inserted sample data');
    } catch (error) {
      console.error('Error inserting sample data:', error.message);
    }

    // Step 7: Verify the new structure
    console.log('\nVerifying new table structures...');
    
    // Show lists table structure
    try {
      const [listsDesc] = await connection.query("DESCRIBE lists");
      console.log('\n✓ New Lists table structure:');
      listsDesc.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
    } catch (error) {
      console.error('❌ Error describing lists table:', error.message);
    }
    
    // Show contacts table structure
    try {
      const [contactsDesc] = await connection.query("DESCRIBE contacts");
      console.log('\n✓ New Contacts table structure:');
      contactsDesc.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
    } catch (error) {
      console.error('❌ Error describing contacts table:', error.message);
    }

    // Show sample data
    try {
      const [lists] = await connection.query("SELECT * FROM lists");
      console.log('\n✓ Sample lists data:');
      lists.forEach(list => {
        console.log(`  - ${list.listName} (${list.type}): ${list.contacts_count} contacts`);
      });

      const [contacts] = await connection.query("SELECT * FROM contacts LIMIT 5");
      console.log('\n✓ Sample contacts data:');
      contacts.forEach(contact => {
        console.log(`  - ${contact.fullName} (${contact.email}) - List ID: ${contact.listId}`);
      });
    } catch (error) {
      console.error('❌ Error showing sample data:', error.message);
    }
    
    console.log('\n✅ Database schema update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating database schema:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Run the update
updateDatabaseSchema();
