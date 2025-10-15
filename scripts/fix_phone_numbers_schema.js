const pool = require('../config/DBConnection');

async function fixPhoneNumbersSchema() {
  try {
    console.log('🔧 Starting phone numbers schema fix...');

    // Step 1: Check current schema
    console.log('📋 Checking current schema...');
    const [schemaInfo] = await pool.execute(`
      SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ai_agent' 
        AND TABLE_NAME = 'phone_numbers' 
        AND COLUMN_NAME = 'user_id'
    `);
    
    console.log('Current user_id column info:', schemaInfo[0]);

    // Step 2: Modify the user_id column to allow NULL values
    console.log('🔄 Modifying user_id column to allow NULL...');
    await pool.execute(`
      ALTER TABLE phone_numbers 
      MODIFY COLUMN user_id INT NULL
    `);
    console.log('✅ user_id column modified successfully');

    // Step 3: Update any records with user_id = -1 back to NULL
    console.log('🔄 Updating any user_id = -1 records to NULL...');
    const [updateResult] = await pool.execute(`
      UPDATE phone_numbers 
      SET user_id = NULL 
      WHERE user_id = -1 OR user_id = 0
    `);
    console.log(`✅ Updated ${updateResult.affectedRows} records`);

    // Step 4: Verify the change
    console.log('🔍 Verifying schema change...');
    const [newSchemaInfo] = await pool.execute(`
      SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'ai_agent' 
        AND TABLE_NAME = 'phone_numbers' 
        AND COLUMN_NAME = 'user_id'
    `);
    
    console.log('New user_id column info:', newSchemaInfo[0]);

    // Step 5: Show current phone number assignments
    console.log('📱 Current phone number assignments:');
    const [phoneNumbers] = await pool.execute(`
      SELECT 
        pn.id,
        pn.number,
        pn.user_id,
        u.first_name,
        u.last_name,
        u.email
      FROM phone_numbers pn
      LEFT JOIN users u ON pn.user_id = u.id
      WHERE pn.status = 'active'
      ORDER BY pn.id
    `);

    phoneNumbers.forEach(phone => {
      const assignment = phone.user_id 
        ? `${phone.first_name} ${phone.last_name} (${phone.email})`
        : 'UNASSIGNED';
      console.log(`  📞 ${phone.number} → ${assignment}`);
    });

    console.log('🎉 Schema fix completed successfully!');
    console.log('');
    console.log('📋 Summary:');
    console.log('  ✅ user_id column now allows NULL values');
    console.log('  ✅ Unassigned phone numbers will have user_id = NULL');
    console.log('  ✅ Phone number unassignment should now work properly');

  } catch (error) {
    console.error('❌ Error fixing phone numbers schema:', error);
    throw error;
  }
}

// Run the fix
if (require.main === module) {
  fixPhoneNumbersSchema()
    .then(() => {
      console.log('✅ Schema fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Schema fix failed:', error);
      process.exit(1);
    });
}

module.exports = { fixPhoneNumbersSchema };
