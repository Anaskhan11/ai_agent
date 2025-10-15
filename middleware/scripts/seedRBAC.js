const fs = require('fs');
const path = require('path');
const pool = require('../config/DBConnection');

async function seedRBAC() {
  try {
    console.log('🌱 Starting RBAC seed process...');
    
    // Read the SQL seed file
    const seedFilePath = path.join(__dirname, '../database/rbac_seed.sql');
    const seedSQL = fs.readFileSync(seedFilePath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = seedSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await pool.execute(statement);
          console.log(`✅ Executed statement ${i + 1}/${statements.length}`);
        } catch (error) {
          console.error(`❌ Error executing statement ${i + 1}:`, error.message);
          console.error('Statement:', statement.substring(0, 100) + '...');
        }
      }
    }
    
    console.log('🎉 RBAC seed process completed successfully!');
    console.log('\n📋 Summary:');
    console.log('- Created default roles: super_admin, admin, manager, user');
    console.log('- Created system permissions for all major features');
    console.log('- Created page permissions for route protection');
    console.log('- Assigned permissions to roles based on hierarchy');
    console.log('\n🔑 Next steps:');
    console.log('1. Assign users to appropriate roles');
    console.log('2. Test the permission system in the frontend');
    console.log('3. Customize permissions as needed for your use case');
    
  } catch (error) {
    console.error('💥 Error during RBAC seed process:', error);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the seed function if this script is executed directly
if (require.main === module) {
  seedRBAC();
}

module.exports = seedRBAC;
