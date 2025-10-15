const fs = require('fs');
const path = require('path');
const pool = require('../config/DBConnection');

async function runMigration() {
  try {
    console.log('Starting database migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../database/migrations/create_role_page_permissions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        await pool.execute(statement);
        console.log(`✓ Statement ${i + 1} executed successfully`);
      } catch (error) {
        if (error.code === 'ER_TABLE_EXISTS_ERROR') {
          console.log(`⚠ Table already exists, skipping statement ${i + 1}`);
        } else if (error.code === 'ER_DUP_ENTRY') {
          console.log(`⚠ Duplicate entry, skipping statement ${i + 1}`);
        } else {
          console.error(`✗ Error executing statement ${i + 1}:`, error.message);
          throw error;
        }
      }
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table was created
    const [tables] = await pool.execute("SHOW TABLES LIKE 'role_page_permissions'");
    if (tables.length > 0) {
      console.log('✅ role_page_permissions table verified');
      
      // Check if data was inserted
      const [count] = await pool.execute("SELECT COUNT(*) as count FROM role_page_permissions");
      console.log(`📊 role_page_permissions table has ${count[0].count} records`);
    } else {
      console.log('❌ role_page_permissions table not found');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the migration
runMigration();
