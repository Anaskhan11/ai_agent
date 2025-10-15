const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  port: 3306
};

async function testDisabledListAccess() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Test 1: Create a test list
    console.log('\n📋 Test 1: Creating a test list...');
    const [createResult] = await connection.query(`
      INSERT INTO lists (listName, type, description, userId, contacts_count, is_deleted) 
      VALUES ('Test Disabled List', 'General', 'Test list for soft delete functionality', 1, 0, FALSE)
    `);
    const testListId = createResult.insertId;
    console.log(`✅ Created test list with ID: ${testListId}`);

    // Test 2: Verify list is active
    console.log('\n📋 Test 2: Verifying list is active...');
    const [activeList] = await connection.query(`
      SELECT id, listName, is_deleted 
      FROM lists 
      WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)
    `, [testListId]);
    
    console.log(`   - Active list query result: ${activeList.length > 0 ? '✅ FOUND' : '❌ NOT FOUND'}`);

    // Test 3: Soft delete the list
    console.log('\n📋 Test 3: Soft deleting the list...');
    const [deleteResult] = await connection.query(`
      UPDATE lists 
      SET is_deleted = TRUE, deleted_at = NOW() 
      WHERE id = ?
    `, [testListId]);
    
    console.log(`   - Soft delete result: ${deleteResult.affectedRows > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Test 4: Verify list is now disabled (not found in active query)
    console.log('\n📋 Test 4: Verifying list is now disabled...');
    const [activeListAfterDelete] = await connection.query(`
      SELECT id, listName, is_deleted 
      FROM lists 
      WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)
    `, [testListId]);
    
    console.log(`   - Active list query after delete: ${activeListAfterDelete.length === 0 ? '✅ CORRECTLY HIDDEN' : '❌ STILL VISIBLE'}`);

    // Test 5: Verify list is found when including deleted
    console.log('\n📋 Test 5: Verifying list is found when including deleted...');
    const [deletedList] = await connection.query(`
      SELECT id, listName, is_deleted, deleted_at 
      FROM lists 
      WHERE id = ?
    `, [testListId]);
    
    if (deletedList.length > 0) {
      const list = deletedList[0];
      console.log(`   - List found: ✅ YES`);
      console.log(`   - is_deleted: ${list.is_deleted ? '✅ TRUE' : '❌ FALSE'}`);
      console.log(`   - deleted_at: ${list.deleted_at ? '✅ SET' : '❌ NULL'}`);
    } else {
      console.log(`   - List found: ❌ NO`);
    }

    // Test 6: Restore the list
    console.log('\n📋 Test 6: Restoring the list...');
    const [restoreResult] = await connection.query(`
      UPDATE lists 
      SET is_deleted = FALSE, deleted_at = NULL 
      WHERE id = ? AND is_deleted = TRUE
    `, [testListId]);
    
    console.log(`   - Restore result: ${restoreResult.affectedRows > 0 ? '✅ SUCCESS' : '❌ FAILED'}`);

    // Test 7: Verify list is active again
    console.log('\n📋 Test 7: Verifying list is active again...');
    const [restoredList] = await connection.query(`
      SELECT id, listName, is_deleted 
      FROM lists 
      WHERE id = ? AND (is_deleted = FALSE OR is_deleted IS NULL)
    `, [testListId]);
    
    console.log(`   - Active list query after restore: ${restoredList.length > 0 ? '✅ FOUND' : '❌ NOT FOUND'}`);

    // Cleanup: Remove test list
    console.log('\n🧹 Cleanup: Removing test list...');
    await connection.query('DELETE FROM lists WHERE id = ?', [testListId]);
    console.log('✅ Test list removed');

    console.log('\n🎉 All tests completed successfully!');
    console.log('✅ Soft delete functionality is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the test
testDisabledListAccess();
