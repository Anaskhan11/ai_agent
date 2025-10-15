const mysql = require('mysql2/promise');

async function addCampaignCreationPricing() {
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

    // Add campaign_creation pricing entry
    console.log('➕ Adding campaign_creation pricing entry...');
    
    const [result] = await connection.execute(`
      INSERT INTO credit_pricing (operation_type, unit_type, credits_per_unit, description) 
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      credits_per_unit = VALUES(credits_per_unit),
      description = VALUES(description),
      updated_at = CURRENT_TIMESTAMP
    `, ['campaign_creation', 'per_campaign', 2.00, 'Campaign creation operation']);

    console.log(`✅ Added/Updated pricing for campaign_creation: 2 credits`);

    // Verify all campaign-related pricing entries
    console.log('\n📋 All campaign-related pricing entries:');
    const [rows] = await connection.execute(`
      SELECT operation_type, unit_type, credits_per_unit, description, is_active 
      FROM credit_pricing 
      WHERE operation_type LIKE '%campaign%'
      ORDER BY operation_type, unit_type
    `);

    console.table(rows);

    // Show all current pricing entries for the features we've added
    console.log('\n📋 All feature pricing entries:');
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
addCampaignCreationPricing();
