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

async function modifyDatabaseStructure() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await pool.getConnection();
    
    // Step 1: Add userId column to lists table if it doesn't exist
    console.log('Adding userId column to lists table...');
    try {
      await connection.query('ALTER TABLE lists ADD COLUMN userId INT NOT NULL');
      console.log('✓ Added userId column to lists table');
    } catch (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log('⚠ userId column already exists in lists table');
      } else {
        console.error('Error adding userId column to lists:', error.message);
      }
    }
    
    // Step 2: Remove user_id column from lists table if it exists
    console.log('Removing user_id column from lists table...');
    try {
      await connection.query('ALTER TABLE lists DROP COLUMN user_id');
      console.log('✓ Removed user_id column from lists table');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠ user_id column does not exist in lists table');
      } else {
        console.error('Error removing user_id column from lists:', error.message);
      }
    }
    
    // Step 3: Remove user_id column from contacts table if it exists
    console.log('Removing user_id column from contacts table...');
    try {
      await connection.query('ALTER TABLE contacts DROP COLUMN user_id');
      console.log('✓ Removed user_id column from contacts table');
    } catch (error) {
      if (error.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠ user_id column does not exist in contacts table');
      } else {
        console.error('Error removing user_id column from contacts:', error.message);
      }
    }
    
    // Step 4: Add indexes for better performance
    try {
      await connection.query('ALTER TABLE lists ADD INDEX idx_userId (userId)');
      console.log('✓ Added index on userId in lists table');
    } catch (error) {
      if (error.code === 'ER_DUP_KEYNAME') {
        console.log('⚠ Index on userId already exists in lists table');
      } else {
        console.error('Error adding index on userId in lists:', error.message);
      }
    }
    
    // Step 5: Drop and recreate triggers with updated logic
    console.log('Updating triggers...');
    
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
      console.log('✓ Updated insert trigger');
    } catch (error) {
      console.error('Error updating insert trigger:', error.message);
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
      console.log('✓ Updated delete trigger');
    } catch (error) {
      console.error('Error updating delete trigger:', error.message);
    }
    
    // Step 6: Verify the new structure
    console.log('\nVerifying updated table structures...');
    
    // Show lists table structure
    try {
      const [listsDesc] = await connection.query("DESCRIBE lists");
      console.log('\n✓ Updated Lists table structure:');
      listsDesc.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
    } catch (error) {
      console.error('❌ Error describing lists table:', error.message);
    }
    
    // Show contacts table structure
    try {
      const [contactsDesc] = await connection.query("DESCRIBE contacts");
      console.log('\n✓ Updated Contacts table structure:');
      contactsDesc.forEach(col => {
        console.log(`  - ${col.Field}: ${col.Type}`);
      });
    } catch (error) {
      console.error('❌ Error describing contacts table:', error.message);
    }
    
    console.log('\n✅ Database structure modification completed successfully!');
    
  } catch (error) {
    console.error('❌ Error modifying database structure:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Run the modification
modifyDatabaseStructure();
