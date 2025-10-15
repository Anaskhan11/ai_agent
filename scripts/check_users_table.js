const db = require('../config/DBConnection');

async function checkUsersTable() {
  try {
    console.log('🔍 Checking users table structure...');

    // Get table structure
    const [rows] = await db.execute('DESCRIBE users');
    
    console.log('📋 Users table structure:');
    console.table(rows);

    // Check the id column specifically
    const idColumn = rows.find(row => row.Field === 'id');
    if (idColumn) {
      console.log('🔑 ID column details:', idColumn);
    }

  } catch (error) {
    console.error('❌ Error checking users table:', error);
  } finally {
    process.exit(0);
  }
}

checkUsersTable();
