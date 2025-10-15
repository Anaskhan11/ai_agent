const mysql = require('mysql2/promise');

// Database configuration - using the same config as DBConnection.js
const dbConfig = {
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  port: 3306
};

async function testSoftDeleteFunctionality() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Test 1: Check if soft delete columns exist
    console.log('\n📋 Test 1: Checking if soft delete columns exist...');
    const [columns] = await connection.query("SHOW COLUMNS FROM lists");
    const columnNames = columns.map(col => col.Field);
    
    const hasIsDeleted = columnNames.includes('is_deleted');
    const hasDeletedAt = columnNames.includes('deleted_at');
    
    console.log(`   - is_deleted column: ${hasIsDeleted ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   - deleted_at column: ${hasDeletedAt ? '✅ EXISTS' : '❌ MISSING'}`);

    if (!hasIsDeleted || !hasDeletedAt) {
      console.log('❌ Soft delete columns are missing. Please run the migration first.');
      return;
    }

    // Test 2: Check current lists structure
    console.log('\n📋 Test 2: Checking current lists...');
    const [lists] = await connection.query("SELECT id, listName, is_deleted, deleted_at FROM lists LIMIT 5");
    console.log(`   Found ${lists.length} lists in database`);
    
    if (lists.length > 0) {
      console.log('   Sample lists:');
      lists.forEach(list => {
        const status = list.is_deleted ? '🔴 DELETED' : '🟢 ACTIVE';
        console.log(`   - ID: ${list.id}, Name: ${list.listName}, Status: ${status}`);
      });
    }

    // Test 3: Test soft delete query
    console.log('\n📋 Test 3: Testing soft delete query...');
    const [activeListsOnly] = await connection.query(`
      SELECT COUNT(*) as count 
      FROM lists 
      WHERE (is_deleted = FALSE OR is_deleted IS NULL)
    `);
    
    const [allLists] = await connection.query("SELECT COUNT(*) as count FROM lists");
    
    console.log(`   - Total lists: ${allLists[0].count}`);
    console.log(`   - Active lists: ${activeListsOnly[0].count}`);
    console.log(`   - Deleted lists: ${allLists[0].count - activeListsOnly[0].count}`);

    // Test 4: Check indexes
    console.log('\n📋 Test 4: Checking indexes...');
    const [indexes] = await connection.query("SHOW INDEX FROM lists WHERE Column_name = 'is_deleted'");
    console.log(`   - is_deleted index: ${indexes.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);

    console.log('\n🎉 Soft delete functionality test completed successfully!');
    console.log('✅ The database is ready for soft delete operations');

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
testSoftDeleteFunctionality();
