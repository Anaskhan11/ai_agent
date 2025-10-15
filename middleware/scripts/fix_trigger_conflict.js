const pool = require('../config/DBConnection');

async function fixTriggerConflict() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await pool.getConnection();
    
    console.log('Dropping problematic UPDATE trigger...');
    
    // Drop the update trigger that's causing conflicts
    await connection.query('DROP TRIGGER IF EXISTS update_list_count_update');
    console.log('✓ Dropped update_list_count_update trigger');
    
    // Create a simpler update trigger that only updates when listId changes
    console.log('Creating new conditional UPDATE trigger...');
    await connection.query(`
      CREATE TRIGGER update_list_count_update
      AFTER UPDATE ON contacts
      FOR EACH ROW
      BEGIN
        -- Only update counts if the listId actually changed
        IF OLD.listId != NEW.listId THEN
          -- Update old list count
          UPDATE lists 
          SET contacts_count = (
            SELECT COUNT(*) 
            FROM contacts 
            WHERE listId = OLD.listId
          )
          WHERE id = OLD.listId;
          
          -- Update new list count
          UPDATE lists 
          SET contacts_count = (
            SELECT COUNT(*) 
            FROM contacts 
            WHERE listId = NEW.listId
          )
          WHERE id = NEW.listId;
        END IF;
      END
    `);
    console.log('✓ Created new conditional UPDATE trigger');
    
    // Also fix the DELETE trigger to avoid similar conflicts
    console.log('Fixing DELETE trigger...');
    await connection.query('DROP TRIGGER IF EXISTS update_list_count_delete');
    await connection.query(`
      CREATE TRIGGER update_list_count_delete
      AFTER DELETE ON contacts
      FOR EACH ROW
      UPDATE lists
      SET contacts_count = GREATEST(0, (
        SELECT COUNT(*)
        FROM contacts
        WHERE listId = OLD.listId
      ))
      WHERE id = OLD.listId
    `);
    console.log('✓ Fixed DELETE trigger');

    console.log('✅ All trigger conflicts fixed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing trigger conflict:', error.message);
    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
    process.exit(0);
  }
}

// Run the fix
fixTriggerConflict().catch(console.error);
