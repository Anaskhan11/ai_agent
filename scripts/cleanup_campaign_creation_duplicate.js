const mysql = require('mysql2/promise');

async function cleanupCampaignCreationDuplicate() {
  let connection;
  
  try {
    // Create database connection
    connection = await mysql.createConnection({
      host: "37.27.187.4",
      user: "root",
      password: "l51Qh6kM2vb3npALukrKNMzNAlBogTj0NSH4Gd3IxqMfaP0qfFkp54e7jcknqGNX",
      database: "ai_agent",
      port: 3306
    });

    console.log('✅ Connected to database');

    // Remove the old campaign_creation entry with 'Campaign creation and setup' description
    console.log('🧹 Cleaning up duplicate campaign_creation entries...');
    
    const [deleteResult] = await connection.execute(`
      DELETE FROM credit_pricing 
      WHERE operation_type = 'campaign_creation' 
        AND unit_type = 'per_campaign' 
        AND description = 'Campaign creation and setup'
    `);

    console.log(`✅ Removed ${deleteResult.affectedRows} duplicate entries`);

    // Verify the cleanup
    console.log('\n📋 Current campaign_creation pricing entries:');
    const [rows] = await connection.execute(`
      SELECT operation_type, unit_type, credits_per_unit, description, is_active 
      FROM credit_pricing 
      WHERE operation_type = 'campaign_creation'
      ORDER BY credits_per_unit
    `);

    console.table(rows);

    // Show final summary of all feature pricing
    console.log('\n📋 Final feature pricing summary:');
    const [allRows] = await connection.execute(`
      SELECT operation_type, unit_type, credits_per_unit, description, is_active 
      FROM credit_pricing 
      WHERE operation_type IN ('phone_number_creation', 'campaign_creation', 'campaign_launch', 'assistant_creation', 'phone_number_purchase')
      ORDER BY operation_type, unit_type
    `);

    console.table(allRows);

  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    if (connection) {
      await connection.end();
      console.log('✅ Database connection closed');
    }
  }
}

// Run the script
cleanupCampaignCreationDuplicate();
