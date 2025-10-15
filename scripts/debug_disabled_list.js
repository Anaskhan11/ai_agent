const mysql = require('mysql2/promise');

// Database configuration
const dbConfig = {
  host: "37.27.187.4",
  user: "root",
  password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
  database: "ai_agent",
  port: 3306
};

async function debugDisabledList() {
  let connection;
  
  try {
    console.log('🔄 Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database successfully');

    // Get all lists with their disabled status
    console.log('\n📋 Current lists status:');
    const [lists] = await connection.query(`
      SELECT id, listName, is_deleted, deleted_at, userId
      FROM lists 
      ORDER BY id
    `);
    
    console.log('Total lists found:', lists.length);
    lists.forEach(list => {
      const status = list.is_deleted ? '🔴 DISABLED' : '🟢 ACTIVE';
      const deletedAt = list.deleted_at ? new Date(list.deleted_at).toLocaleString() : 'N/A';
      console.log(`   - ID: ${list.id}, Name: ${list.listName}, Status: ${status}, Deleted: ${deletedAt}, User: ${list.userId}`);
    });

    // Test the API query that frontend uses
    console.log('\n📋 Testing frontend API query (excluding deleted):');
    const [activeLists] = await connection.query(`
      SELECT id, listName as list_name, type, contacts_count as contactCount, 
             createdAt, userId, description as list_description, is_deleted, deleted_at
      FROM lists 
      WHERE (is_deleted = FALSE OR is_deleted IS NULL)
      ORDER BY createdAt DESC
    `);
    
    console.log('Active lists returned to frontend:', activeLists.length);
    activeLists.forEach(list => {
      console.log(`   - ID: ${list.id}, Name: ${list.list_name}, is_deleted: ${list.is_deleted}`);
    });

    // Test the API query that super admin uses
    console.log('\n📋 Testing super admin API query (including deleted):');
    const [allLists] = await connection.query(`
      SELECT id, listName as list_name, type, contacts_count as contactCount, 
             createdAt, userId, description as list_description, is_deleted, deleted_at
      FROM lists 
      ORDER BY createdAt DESC
    `);
    
    console.log('All lists returned to super admin:', allLists.length);
    allLists.forEach(list => {
      const status = list.is_deleted ? '🔴 DISABLED' : '🟢 ACTIVE';
      console.log(`   - ID: ${list.id}, Name: ${list.list_name}, Status: ${status}, is_deleted: ${list.is_deleted}`);
    });

    // Find a disabled list for testing
    const disabledList = allLists.find(list => list.is_deleted);
    if (disabledList) {
      console.log(`\n🎯 Found disabled list for testing: ID ${disabledList.id} (${disabledList.list_name})`);
      
      // Test getListById query
      console.log('\n📋 Testing getListById for disabled list:');
      const [listById] = await connection.query(`
        SELECT id, listName as list_name, type, contacts_count as contactCount, 
               createdAt, userId, description as list_description, is_deleted, deleted_at
        FROM lists
        WHERE id = ? AND userId = ?
      `, [disabledList.id, disabledList.userId]);
      
      if (listById.length > 0) {
        const list = listById[0];
        console.log(`   - Found: ${list.list_name}, is_deleted: ${list.is_deleted}`);
        console.log(`   - This should be blocked for regular users in the API`);
      } else {
        console.log('   - List not found (this is unexpected)');
      }
    } else {
      console.log('\n🎯 No disabled lists found. To create one for testing:');
      if (allLists.length > 0) {
        const testList = allLists[0];
        console.log(`   UPDATE lists SET is_deleted = TRUE, deleted_at = NOW() WHERE id = ${testList.id};`);
      }
    }

  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the debug
debugDisabledList();
